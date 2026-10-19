"""Build original fictional source data for the offline UI demo."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATE = "2026-10-01T10:00:00Z"


def body(text):
    return {"text": text, "characters": len(text), "truncated": False}


def comment(id, author, text, page, kind="User", association="NONE"):
    return {"id": id, "url": None, "author": author, "account_type": kind, "association": association, "created_at": DATE, "updated_at": DATE, "page": page, "body": body(text)}


report = {
    "schema_version": 1, "tool": "GapCue", "tool_version": "0.1.0", "synthetic": True,
    "started_at": DATE, "captured_at": DATE, "collection_status": "complete",
    "parameters": {"backend": "fictional sample", "page_size": 3, "issue_limit": 2, "reference_limit": 6},
    "search": None,
    "repositories": [{"full_name": "sample/research-board", "available": True, "stars": None, "url": None, "captured_at": DATE}],
    "requests": [], "failures": [],
    "issues": [
        {
            "key": "sample/research-board#17", "repository": "sample/research-board", "number": 17, "url": None, "available": True,
            "title": "Export selected rows as CSV", "state": "open", "state_reason": None,
            "author": "requester", "account_type": "User", "association": "NONE", "created_at": DATE, "updated_at": DATE,
            "labels": ["feature request"], "body": body("I review research rows in a spreadsheet. Could the board export just the selected rows, including their source links? Copying them one at a time is the slow part."),
            "comments": {
                "available": True, "reported_total": 11, "pages": [1, 4], "has_unread": True,
                "order": "Fictional first and last pages; six middle comments omitted",
                "entries": [
                    comment(1, "reader-a", "I also need the source URL beside each exported row.", 1),
                    comment(2, "maintainer", "A small export action could fit here. We need to preserve the selected row order.", 1, association="MEMBER"),
                    comment(3, "automation[bot]", "This fictional request has been added to the review queue.", 1, kind="Bot"),
                    comment(10, "maintainer", "The selected-row export is implemented in pull request #42. Please check the current build before starting another exporter.", 4, association="MEMBER"),
                    comment(11, "requester", "I will try the current build with my spreadsheet workflow.", 4),
                ],
            },
            "references": [{"url": None, "repository": "sample/research-board", "number": 42, "kind": "pull_request", "check": "checked", "state": "merged", "merged_at": DATE, "captured_at": DATE, "reason": "Fictional sample PR state; not a real project result."}],
        },
        {
            "key": "sample/research-board#23", "repository": "sample/research-board", "number": 23, "url": None, "available": True,
            "title": "Keep reviewer notes when reopening a report", "state": "open", "state_reason": None,
            "author": "reader-b", "account_type": "User", "association": "NONE", "created_at": DATE, "updated_at": DATE,
            "labels": ["workflow"], "body": body("After reading several threads I close the tab. On the next day I want the exact source snapshot and my own decision notes together in one local file."),
            "comments": {"available": True, "reported_total": 2, "pages": [1], "has_unread": False, "order": "All two fictional comments",
                "entries": [comment(21, "maintainer", "Would a downloadable review bundle work without a cloud account?", 1, association="MEMBER"), comment(22, "reader-b", "Yes. I need to reopen the evidence and notes together; shared storage can wait.", 1)]},
            "references": [],
        },
    ],
}
text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
(ROOT / "examples").mkdir(exist_ok=True)
(ROOT / "app").mkdir(exist_ok=True)
(ROOT / "examples/sample-report.json").write_text(text, encoding="utf8")
(ROOT / "app/sample.js").write_text("/* Original fictional sample by LydiaTools. */\nwindow.GapCueSampleText = " + json.dumps(text, ensure_ascii=False) + ";\n", encoding="utf8")
print("Built clearly marked fictional sample; no real third-party posts or adoption metrics.")
