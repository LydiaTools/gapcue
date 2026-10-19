# Report and review format · version 1

`gapcue.py collect` creates a UTF-8 JSON report (`tool: "GapCue"`, `schema_version: 1`) of at most 8 MiB.

- `synthetic` distinguishes original demo/test material from a real collection. It does not authenticate the report.
- `started_at`, `captured_at` and per-request timestamps describe a sequence of reads, not one atomic snapshot.
- `collection_status` is `complete` when all requested reads completed, or `partial` when `failures` is nonempty. This is not a full-thread or opportunity verdict.
- `parameters` records backend, issue limit, comment page size and reference budget.
- `repositories` records public-visibility checks and point-in-time metadata. Unavailable/private repositories have no thread content fetched by the collector.
- `issues` contains up to six selected issues. Unavailable entries retain an error. Available entries have original excerpts, basic author metadata, comments and mentioned references.
- An excerpt is `{text, truncated, characters}`. `characters` counts Python Unicode code points in the original field; `text` can be shorter. Issue bodies are capped at 8,000 code points, comment bodies at 4,000. Viewer lengths use compatible code-point counts.
- `comments` records GitHub's reported count, attempted first/last pages and deduplicated entries with page and comment IDs. `available: false` can coexist with successfully read entries. `has_unread` flags omission/failure; changes during collection can make reported counts drift.
- Reference `check` is `checked`, `not_checked`, `unavailable` or `link_only`. Checked issue/PR state is separate from the selected issue state. `merged` requires a PR's nonempty `merged_at`. Simple references are sampled from newest collected comments, then the issue body; the budget is shared across selected issues. Links beyond the budget stay visible. There is no PR timeline or release check.
- `requests` records endpoint, query parameters, timestamps and success/unavailability, without credentials. `failures` retains source identifiers. Responses are not cached between runs.

The CLI uses GET requests only. `--backend public` reads the REST API anonymously. `--backend gh` invokes the installed `gh api --method GET` with an argument array. It does not access or export `gh`'s credential storage. GitHub API failures are not retried.

The browser creates a separate review bundle (`tool: "GapCueReview"`, `schema_version: 1`):

```json
{
  "schema_version": 1,
  "tool": "GapCueReview",
  "saved_at": "ISO timestamp",
  "source_sha256": "64 lowercase hexadecimal characters",
  "source_text": "exact original UTF-8 report text",
  "decisions": {
    "owner/repo#123": {
      "verdict": "followup",
      "notes": "The reviewer's own notes",
      "updated_at": "ISO timestamp"
    }
  }
}
```

Valid decisions: `unreviewed`, `followup`, `prototype`, `pass`. Notes are limited to 6,000 JavaScript string units per issue. The viewer accepts files up to 20 MiB and requires a matching SHA-256 for a bundled source. It rejects duplicate issue keys, unsafe source URLs and decisions for issues absent from the source. Source text is displayed as inert plain text, not rendered HTML/Markdown.

A SHA-256 is an integrity check, not a signed provenance record. A person can deliberately edit both source and hash. Both the original excerpts and personal review notes are present in a saved bundle; it is not a redaction mechanism.

Official API references: [issue comments](https://docs.github.com/en/rest/issues/comments#list-issue-comments-for-a-repository) (ascending ID order), [issues](https://docs.github.com/en/rest/issues/issues#get-an-issue), [pull requests](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request), [search](https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests). These API contracts can change.
