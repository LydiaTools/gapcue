import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("gapcue", ROOT / "gapcue.py")
gapcue = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gapcue)


def meta(private=False):
    return {"full_name": "sample/project", "private": private, "visibility": "private" if private else "public", "stargazers_count": 7, "description": "Test repository"}


def issue(number=1, comments=0, body="A useful request", **extra):
    return {"number": number, "title": "A request", "state": "open", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-02T00:00:00Z", "comments": comments, "user": {"login": "requester", "type": "User"}, "body": body, **extra}


def comment(id, body="Discussed", user="reader", kind="User"):
    return {"id": id, "html_url": f"https://github.com/sample/project/issues/1#issuecomment-{id}", "body": body, "created_at": f"2026-01-{min(id,28):02}T00:00:00Z", "user": {"login": user, "type": kind}}


class FakeClient:
    backend = "fixture"

    def __init__(self, replies):
        self.replies = replies
        self.requests = []

    def get(self, endpoint, **params):
        key = (endpoint, tuple(sorted(params.items())))
        self.requests.append({"endpoint": endpoint, "params": params})
        value = self.replies.get(key, self.replies.get(endpoint))
        if isinstance(value, Exception):
            raise value
        if value is None:
            raise RuntimeError("No fixture for " + repr(key))
        return copy.deepcopy(value)


class CollectionTests(unittest.TestCase):
    def test_private_metadata_stops_before_content(self):
        client = FakeClient({"repos/sample/project": meta(True)})
        result = gapcue.Collector(client).collect([("sample/project", 1)])
        self.assertEqual([x["endpoint"] for x in client.requests], ["repos/sample/project"])
        self.assertEqual(result["collection_status"], "partial")
        self.assertFalse(result["issues"][0]["available"])

    def test_first_last_pages_keep_gap_and_bot_identity(self):
        client = FakeClient({"repos/sample/project": meta(), "repos/sample/project/issues/1": issue(comments=11),
            ("repos/sample/project/issues/1/comments", (("page", 1), ("per_page", 3))): [comment(1), comment(2), comment(3)],
            ("repos/sample/project/issues/1/comments", (("page", 4), ("per_page", 3))): [comment(10, user="review[bot]", kind="Bot"), comment(11)]})
        result = gapcue.Collector(client, page_size=3).collect([("sample/project", 1)])
        sample = result["issues"][0]["comments"]
        self.assertEqual(sample["pages"], [1, 4])
        self.assertEqual([c["id"] for c in sample["entries"]], [1, 2, 3, 10, 11])
        self.assertTrue(sample["has_unread"])
        self.assertEqual(sample["entries"][3]["account_type"], "Bot")
        self.assertEqual(result["collection_status"], "complete")

    def test_failed_last_page_is_partial_not_empty_success(self):
        client = FakeClient({"repos/sample/project": meta(), "repos/sample/project/issues/1": issue(comments=4),
            ("repos/sample/project/issues/1/comments", (("page", 1), ("per_page", 2))): [comment(1), comment(2)],
            ("repos/sample/project/issues/1/comments", (("page", 2), ("per_page", 2))): RuntimeError("rate limited")})
        result = gapcue.Collector(client, page_size=2).collect([("sample/project", 1)])
        self.assertEqual(result["collection_status"], "partial")
        self.assertEqual(len(result["issues"][0]["comments"]["entries"]), 2)
        self.assertFalse(result["issues"][0]["comments"]["available"])

    def test_merged_and_closed_prs_stay_distinct(self):
        client = FakeClient({"repos/sample/project": meta(), "repos/sample/project/issues/1": issue(body="See #2 and https://github.com/sample/project/pull/3"),
            "repos/sample/project/issues/2": issue(2, pull_request={}),
            "repos/sample/project/pulls/2": {"state": "closed", "merged_at": "2026-02-01T00:00:00Z"},
            "repos/sample/project/issues/3": issue(3, pull_request={}),
            "repos/sample/project/pulls/3": {"state": "closed", "merged_at": None}})
        result = gapcue.Collector(client).collect([("sample/project", 1)])
        states = {r["number"]: r["state"] for r in result["issues"][0]["references"]}
        self.assertEqual(states, {2: "merged", 3: "closed"})
        self.assertEqual(result["issues"][0]["state"], "open")

    def test_reference_budget_leaves_visible_unchecked_links(self):
        client = FakeClient({"repos/sample/project": meta(), "repos/sample/project/issues/1": issue(body="See #2 and #3"), "repos/sample/project/issues/2": issue(2)})
        result = gapcue.Collector(client, reference_limit=1).collect([("sample/project", 1)])
        self.assertEqual([r["check"] for r in result["issues"][0]["references"]], ["checked", "not_checked"])

    def test_case_variants_are_one_thread_not_duplicate_research(self):
        client = FakeClient({"repos/sample/project": meta(), "repos/sample/project/issues/1": issue()})
        result = gapcue.Collector(client).collect([("sample/project", 1), ("Sample/Project", 1)])
        self.assertEqual(len(result["issues"]), 1)
        self.assertEqual(len(client.requests), 2)

    def test_markdown_source_title_cannot_escape_link_label(self):
        client = FakeClient({"repos/sample/project": meta(), "repos/sample/project/issues/1": issue()})
        result = gapcue.Collector(client).collect([("sample/project", 1)])
        result["issues"][0]["title"] = r"Backslash \](`code`|<img>)"
        output = gapcue.markdown(result)
        self.assertIn(r"Backslash \\\](\`code\`\|&lt;img&gt;)", output)

    def test_patch_url_is_not_a_merge_or_release_claim(self):
        client = FakeClient({"repos/sample/project": meta(), "repos/sample/project/issues/1": issue(body="Patch https://github.com/sample/project/tree/proposed-fix")})
        result = gapcue.Collector(client).collect([("sample/project", 1)])
        ref = result["issues"][0]["references"][0]
        self.assertEqual(ref["check"], "link_only")
        self.assertNotIn("state", ref)

    def test_pr_target_is_not_collected_as_an_issue(self):
        client = FakeClient({"repos/sample/project": meta(), "repos/sample/project/issues/1": issue(pull_request={})})
        result = gapcue.Collector(client).collect([("sample/project", 1)])
        self.assertFalse(result["issues"][0]["available"])
        self.assertEqual(result["collection_status"], "partial")

    def test_search_restricts_content_to_selected_repo_and_marks_incomplete(self):
        rows = [dict(issue(1), repository_url="https://api.github.com/repos/sample/project"), dict(issue(9), repository_url="https://api.github.com/repos/elsewhere/other")]
        client = FakeClient({"repos/sample/project": meta(), "search/issues": {"total_count": 2, "incomplete_results": True, "items": rows}, "repos/sample/project/issues/1": issue()})
        result = gapcue.Collector(client).collect(repo="sample/project", query="export")
        self.assertEqual([i["number"] for i in result["issues"]], [1])
        self.assertEqual(result["collection_status"], "partial")

    def test_invalid_targets_and_bounds_do_not_request_content(self):
        for text in ["https://evil.invalid/a/b/issues/1", "a/b#0", "a/../b#2", "a/b#2?x=1"]:
            with self.assertRaises(ValueError):
                gapcue.issue_target(text)
        client = FakeClient({})
        with self.assertRaises(ValueError):
            gapcue.Collector(client).collect([("a/b", 0)])
        self.assertEqual(client.requests, [])

    def test_existing_output_rejected_before_network(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(gapcue.Client, "get", side_effect=AssertionError("network called")):
            with self.assertRaises(SystemExit) as error:
                gapcue.main(["collect", "--issue", "sample/project#1", "--out", directory])
            self.assertEqual(error.exception.code, 2)

    def test_gh_backend_always_uses_get_and_never_shell(self):
        fake = type("Result", (), {"returncode": 0, "stdout": '{"ok": true}'})()
        with patch.object(gapcue.subprocess, "run", return_value=fake) as run:
            result = gapcue.Client("gh").get("search/issues", q="a/b")
        args, kwargs = run.call_args
        self.assertIn("GET", args[0])
        self.assertEqual(args[0][0:6], ["gh", "api", "--hostname", "github.com", "--method", "GET"])
        self.assertNotIn("shell", kwargs)
        self.assertEqual(result, {"ok": True})

    def test_failed_source_is_not_replaced_by_a_previous_snapshot(self):
        first = gapcue.Collector(FakeClient({"repos/sample/project": meta(), "repos/sample/project/issues/1": issue()})).collect([("sample/project", 1)])
        second = gapcue.Collector(FakeClient({"repos/sample/project": RuntimeError("offline")})).collect([("sample/project", 1)])
        self.assertTrue(first["issues"][0]["available"])
        self.assertFalse(second["issues"][0]["available"])
        self.assertNotIn("body", second["issues"][0])


if __name__ == "__main__":
    unittest.main()
