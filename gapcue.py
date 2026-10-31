#!/usr/bin/env python3
"""Read-only, bounded public GitHub issue collection. Python 3.10+, stdlib only."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

VERSION = "0.5.0"
MAX_BYTES = 8 * 1024 * 1024
REPO = re.compile(r"[A-Za-z0-9_-]{1,100}/[A-Za-z0-9_.-]{1,100}\Z")
ISSUE = re.compile(r"([A-Za-z0-9_-]+/[A-Za-z0-9_.-]+)#([1-9][0-9]*)\Z")
ISSUE_URL = re.compile(r"https://github\.com/([A-Za-z0-9_-]+/[A-Za-z0-9_.-]+)/issues/([1-9][0-9]*)/?\Z")
LINK = re.compile(r"https://github\.com/([A-Za-z0-9_-]+/[A-Za-z0-9_.-]+)/(pull|issues)/([1-9][0-9]*)(?![A-Za-z0-9])")
PATCH_LINK = re.compile(r"https://github\.com/[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+/(?:commit|tree|compare)/[^\s<>\]\)\"']+")


def now():
    return datetime.now(timezone.utc).isoformat()


def repository(value):
    if not isinstance(value, str) or not REPO.fullmatch(value):
        raise ValueError("Use owner/repository, without a URL or query.")
    if value.split("/")[1] in (".", ".."):
        raise ValueError("Invalid repository name.")
    return value


def issue_target(value):
    match = ISSUE.fullmatch(value) or ISSUE_URL.fullmatch(value)
    if not match:
        raise ValueError("Use owner/repository#123 or a https://github.com/.../issues/123 URL.")
    return repository(match[1]), int(match[2])


def clipped(value, limit):
    text = value if isinstance(value, str) else ""
    return {"text": text[:limit], "truncated": len(text) > limit, "characters": len(text)}


class Client:
    def __init__(self, backend="public", timeout=15):
        self.backend = backend
        self.timeout = timeout
        self.requests = []

    def get(self, endpoint, **params):
        if not re.fullmatch(r"[A-Za-z0-9_./-]+", endpoint) or ".." in endpoint:
            raise ValueError("Unexpected GitHub API endpoint.")
        started = now()
        receipt = {"endpoint": endpoint, "params": params, "started_at": started}
        try:
            if self.backend == "gh":
                command = ["gh", "api", "--hostname", "github.com", "--method", "GET", endpoint]
                for key, value in params.items():
                    command.extend(["-f", f"{key}={value}"])
                result = subprocess.run(command, text=True, capture_output=True, timeout=self.timeout)
                if result.returncode:
                    raise RuntimeError("GitHub CLI request failed; check gh authentication/rate limits.")
                if len(result.stdout.encode("utf8")) > MAX_BYTES:
                    raise ValueError("API response exceeds 8 MiB.")
                data = json.loads(result.stdout)
            else:
                url = "https://api.github.com/" + endpoint
                if params:
                    url += "?" + urlencode(params)
                request = Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "GapCue/" + VERSION, "X-GitHub-Api-Version": "2022-11-28"})
                with urlopen(request, timeout=self.timeout) as response:
                    raw = response.read(MAX_BYTES + 1)
                if len(raw) > MAX_BYTES:
                    raise ValueError("API response exceeds 8 MiB.")
                data = json.loads(raw)
            receipt.update(status="ok", captured_at=now())
            return data
        except Exception as error:
            message = ("GitHub HTTP " + str(error.code)) if isinstance(error, HTTPError) else str(error)
            receipt.update(status="unavailable", captured_at=now(), error=message[:240])
            raise RuntimeError(receipt["error"]) from None
        finally:
            self.requests.append(receipt)


class Collector:
    def __init__(self, client, page_size=10, reference_limit=6):
        if not 1 <= page_size <= 20 or not 0 <= reference_limit <= 6:
            raise ValueError("Comment page size is 1–20; reference limit is 0–6.")
        self.client = client
        self.page_size = page_size
        self.reference_limit = reference_limit
        self.repos = {}
        self.failures = []

    def meta(self, repo):
        repository(repo)
        key = repo.lower()
        if key in self.repos:
            return self.repos[key]
        item = {"requested": repo, "available": False, "captured_at": now()}
        try:
            raw = self.client.get("repos/" + repo)
            if raw.get("private") is not False or raw.get("visibility") != "public":
                raise ValueError("Repository is not public; thread content was not requested.")
            canonical = repository(raw["full_name"])
            item.update(available=True, full_name=canonical, url="https://github.com/" + canonical, stars=raw.get("stargazers_count"), description=clipped(raw.get("description"), 400))
        except Exception as error:
            item["error"] = str(error)[:240]
            self.failures.append("repository:" + repo)
        self.repos[key] = item
        return item

    def comments(self, repo, number, total):
        result = {"available": True, "reported_total": total, "pages": [], "entries": [], "has_unread": False, "order": "GitHub ascending ID; first and last pages by reported count"}
        if total == 0:
            return result
        last = max(1, math.ceil(total / self.page_size))
        seen = set()
        for page in sorted({1, last}):
            result["pages"].append(page)
            try:
                rows = self.client.get(f"repos/{repo}/issues/{number}/comments", per_page=self.page_size, page=page)
                if not isinstance(rows, list):
                    raise ValueError("Comments response is not an array.")
                for raw in rows:
                    if type(raw.get("id")) is not int:
                        raise ValueError("Comment has an invalid ID.")
                    if raw["id"] in seen:
                        continue
                    seen.add(raw["id"])
                    user = raw.get("user") or {}
                    result["entries"].append({"id": raw["id"], "url": raw.get("html_url"), "author": user.get("login", "unknown"), "account_type": user.get("type", "unknown"), "association": raw.get("author_association", "NONE"), "created_at": raw["created_at"], "updated_at": raw.get("updated_at"), "page": page, "body": clipped(raw.get("body"), 4000)})
            except Exception as error:
                result["available"] = False
                result.setdefault("errors", []).append({"page": page, "error": str(error)[:240]})
                self.failures.append(f"comments:{repo}#{number}:page{page}")
        result["entries"].sort(key=lambda c: c["id"])
        result["has_unread"] = not result["available"] or total > len(result["entries"])
        return result

    def thread(self, repo, number):
        item = {"key": f"{repo}#{number}", "repository": repo, "number": number, "url": f"https://github.com/{repo}/issues/{number}", "available": False, "captured_at": now(), "references": []}
        meta = self.meta(repo)
        if not meta["available"]:
            item["error"] = meta["error"]
            return item
        repo = meta["full_name"]
        try:
            raw = self.client.get(f"repos/{repo}/issues/{number}")
            if "pull_request" in raw:
                raise ValueError("This target is a pull request; choose an issue URL.")
            user = raw.get("user") or {}
            item.update(key=f"{repo}#{number}", repository=repo, available=True, url=f"https://github.com/{repo}/issues/{number}", title=raw["title"][:500], state=raw["state"], state_reason=raw.get("state_reason"), created_at=raw["created_at"], updated_at=raw["updated_at"], author=user.get("login", "unknown"), account_type=user.get("type", "unknown"), association=raw.get("author_association", "NONE"), body=clipped(raw.get("body"), 8000), labels=[str(x["name"])[:100] for x in raw.get("labels", [])[:20]])
            item["comments"] = self.comments(repo, number, raw.get("comments", 0))
        except Exception as error:
            item.update(available=False, error=str(error)[:240])
            self.failures.append("issue:" + item["key"])
        return item

    def references(self, issues):
        checked = {}
        for issue in issues:
            if not issue["available"]:
                continue
            sources = [{"url": c["url"], "text": c["body"]["text"]} for c in reversed(issue["comments"]["entries"])]
            sources.append({"url": issue["url"], "text": issue["body"]["text"]})
            found = {}
            for source in sources:
                refs = [(m[1], m[2], int(m[3])) for m in LINK.finditer(source["text"])]
                refs += [(issue["repository"], "issues", int(m[1])) for m in re.finditer(r"(?<![\w/])#([1-9][0-9]{0,8})\b", source["text"])]
                for repo, kind, number in refs:
                    if repo.lower() == issue["repository"].lower() and number == issue["number"]:
                        continue
                    key = (repo.lower(), number)
                    if key not in found:
                        found[key] = {"url": f"https://github.com/{repo}/{kind}/{number}", "repository": repo, "number": number, "mentioned_in": source["url"], "kind": "reference", "check": "not_checked", "reason": "Reference budget; open the source link for review."}
            for key, ref in found.items():
                if key in checked:
                    ref.update(checked[key])
                elif len(checked) < self.reference_limit:
                    value = {"check": "unavailable", "captured_at": now()}
                    meta = self.meta(ref["repository"])
                    if meta["available"]:
                        try:
                            repo = meta["full_name"]
                            raw = self.client.get(f"repos/{repo}/issues/{ref['number']}")
                            is_pr = "pull_request" in raw
                            if is_pr:
                                raw = self.client.get(f"repos/{repo}/pulls/{ref['number']}")
                            if raw.get("state") not in ("open", "closed"):
                                raise ValueError("Reference state is unavailable.")
                            value.update(check="checked", url=f"https://github.com/{repo}/{'pull' if is_pr else 'issues'}/{ref['number']}", kind="pull_request" if is_pr else "issue", state="merged" if is_pr and raw.get("merged_at") else raw["state"], merged_at=raw.get("merged_at"), reason=None)
                        except Exception as error:
                            value["reason"] = str(error)[:240]
                            self.failures.append("reference:" + ref["url"])
                    else:
                        value["reason"] = meta["error"]
                    checked[key] = value
                    ref.update(value)
                issue["references"].append(ref)
            patches = dict.fromkeys(url.rstrip(".,;") for s in sources for url in PATCH_LINK.findall(s["text"]))
            issue["references"].extend({"url": url, "kind": "patch_link", "check": "link_only", "reason": "Mentioned commit/branch/compare URL; not a merged-PR or release check."} for url in list(patches)[:12])

    def collect(self, targets=None, repo=None, query="", limit=4):
        if not 1 <= limit <= 6:
            raise ValueError("Issue limit must be 1–6.")
        started = now()
        search = None
        if repo:
            repo = repository(repo)
            meta = self.meta(repo)
            targets = []
            if meta["available"]:
                try:
                    raw = self.client.get("search/issues", q=f"repo:{meta['full_name']} is:issue {query}", sort="updated", order="desc", per_page=limit, page=1)
                    search = {"total_count": raw["total_count"], "incomplete_results": raw["incomplete_results"], "order": "updated descending, first page", "query": query}
                    if raw["incomplete_results"]:
                        self.failures.append("search:incomplete")
                    for item in raw["items"]:
                        expected = "https://api.github.com/repos/" + meta["full_name"]
                        if "pull_request" not in item and item.get("repository_url", "").lower() == expected.lower():
                            targets.append((meta["full_name"], item["number"]))
                except Exception as error:
                    search = {"available": False, "error": str(error)[:240]}
                    self.failures.append("search:" + repo)
        else:
            targets = list(dict.fromkeys(targets or []))
            if not 1 <= len(targets) <= 6:
                raise ValueError("Choose 1–6 explicit issue targets.")
            for repo_name, number in targets:
                repository(repo_name)
                if type(number) is not int or number < 1 or number > 10**9:
                    raise ValueError("Invalid issue number.")
            unique = {}
            for name, number in targets:
                unique.setdefault((name.lower(), number), (name, number))
            targets = list(unique.values())
        issues = [self.thread(name, num) for name, num in targets[:limit]]
        self.references(issues)
        return {"schema_version": 1, "tool": "GapCue", "tool_version": VERSION, "synthetic": False, "started_at": started, "captured_at": now(), "collection_status": "partial" if self.failures else "complete", "parameters": {"backend": self.client.backend, "page_size": self.page_size, "issue_limit": limit, "reference_limit": self.reference_limit}, "search": search, "repositories": list(self.repos.values()), "issues": issues, "requests": self.client.requests, "failures": self.failures}


def markdown(report):
    def safe(value):
        return str(value).replace("\\", "\\\\").replace("`", "\\`").replace("|", "\\|").replace("\n", " ").replace("<", "&lt;").replace(">", "&gt;").replace("[", "\\[").replace("]", "\\]")
    lines = ["# GapCue research snapshot", "", "Collected: " + report["captured_at"], "", "Collection: " + report["collection_status"], "", "This is a bounded, non-atomic source collection. Open issues, reactions and Stars do not establish an unmet need, independent users or willingness to pay.", "", "| Issue | State | Comments read / reported |", "| --- | --- | ---: |"]
    for issue in report["issues"]:
        if not issue["available"]:
            lines.append(f"| {safe(issue['key'])} | unavailable | — |")
            continue
        comments = issue["comments"]
        lines.append(f"| [{safe(issue['title'])}]({issue['url']}) | {safe(issue['state'])} | {len(comments['entries'])} / {comments['reported_total']} |")
    lines += ["", "Open the JSON in the GapCue viewer to read source excerpts and record your decision. Comment pages can omit the middle of a thread; excerpts can be truncated. Mentioned PR states are collected facts, not a verdict that an issue is solved or a change released.", ""]
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    collect = sub.add_parser("collect", help="Collect a fresh public GitHub snapshot using GET only.")
    source = collect.add_mutually_exclusive_group(required=True)
    source.add_argument("--issue", action="append", help="owner/repository#123 or GitHub issue URL; repeat up to six times.")
    source.add_argument("--repo", help="Search issues in one public owner/repository.")
    collect.add_argument("--query", default="", help="GitHub search terms; results remain restricted to the selected repo.")
    collect.add_argument("--limit", type=int, default=4)
    collect.add_argument("--page-size", type=int, default=10)
    collect.add_argument("--references", type=int, default=6)
    collect.add_argument("--backend", choices=("public", "gh"), default="public")
    collect.add_argument("--timeout", type=int, default=15)
    collect.add_argument("--out", required=True, help="A new output directory; existing paths are never overwritten.")
    args = parser.parse_args(argv)
    try:
        targets = [issue_target(value) for value in (args.issue or [])]
        if args.repo:
            repository(args.repo)
        if len(targets) > 6 or not 1 <= args.limit <= 6 or not 1 <= args.timeout <= 30 or len(args.query) > 200:
            raise ValueError("Use at most six issues, a limit of 1–6, timeout 1–30 seconds and a query up to 200 characters.")
        client = Client(args.backend, args.timeout)
        collector = Collector(client, args.page_size, args.references)
        folder = Path(args.out)
        folder.mkdir(parents=True, exist_ok=False)
        report = collector.collect(targets, args.repo, args.query, args.limit if args.repo else len(targets))
        text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
        data = text.encode("utf8")
        if len(data) > MAX_BYTES:
            raise ValueError("Report exceeds 8 MiB; collect fewer issues.")
        (folder / "report.json").write_bytes(data)
        (folder / "report.md").write_text(markdown(report), encoding="utf8")
        digest = hashlib.sha256(data).hexdigest()
        (folder / "SHA256SUMS.txt").write_text(digest + "  report.json\n", encoding="utf8")
        print(json.dumps({"status": report["collection_status"], "issues": len(report["issues"]), "requests": len(client.requests), "report": str(folder / "report.json"), "sha256": digest, "failures": report["failures"]}, ensure_ascii=False, indent=2))
        return 1 if report["collection_status"] == "partial" else 0
    except (ValueError, OSError) as error:
        parser.exit(2, "GapCue: " + str(error) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
