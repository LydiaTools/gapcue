# Report and review formats

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


## Browser collection and HN version 2

Browser GitHub collection produces the same version-1 report shape: one issue, 10 first/last comments and at most two checked issue/PR references. Browser excerpts are capped at 6,000 Unicode code points. Each response is limited to 1 MiB with a 20-second timeout. Public visibility is checked before GitHub issue content, including cross-repository references. Requests use GET, omit credentials, reject redirects and do not retry. A failed top-level read leaves the current review intact; failed later comment/reference reads are retained as partial.

An HN report has `schema_version: 2`, `source_kind: "hackernews"` and `threads` instead of `issues`. Its key is `hn#<story-id>`; `state: "discussion"` does not impersonate a GitHub issue status. The official HN item API supplies story identity, original event time, points and reported descendant count. HN Search supplies the newest and oldest available indexed comment pages, with up to 10 comments each. `comments.indexed_total` is separate from `comments.reported_total`: indexing and successive reads can disagree. A page being read successfully is not complete discussion coverage.

HN HTML is converted to inert readable text, with anchor destinations retained as text. Excerpt counts refer to that converted text, not raw HTML bytes. Each comment preserves its ID, source URL, original event time, API page (shown 1-based) and `parent_id`. The parent may not be present in this sample; open its source link for context. HN does not supply GitHub association or bot-account metadata, so the viewer does not infer those classifications.

A story's submitted project URL is a `project_link` with `check: "link_only"`. Its repository, license, implementation, releases and demand are not checked. Source URLs are restricted to GitHub or exact HTTPS HN item URLs; project links permit ordinary HTTP(S) destinations but never execute/unfurl their contents. Imports do not trigger source fetches.

Selecting an HN search result also keeps a `discovery` record: query, relevance/date order, explicit period, collection time, result metrics/links, read endpoint and selected story ID. The default is the past 90 days. Search passes `typoTolerance=false` and `removeWordsIfNoResults=none` to avoid spelling expansion or word-dropping fallback; relevance still belongs to the upstream search service, not an opportunity score. Search event dates and collection dates are distinct. These fields identify how the story was found, not causal evidence of a viable product.

When an HN search starts from a GitHub or AgentAtlas repository result, the selected story additionally records `discovery.repository_context` with its original GitHub `full_name`, canonical `url`, and relation `name_search_unverified`. This is the user's search origin, not an assertion that the story is about that repository. The viewer checks its URL and story ID before displaying it and labels the connection unverified. Older reports without this optional field remain valid. The v0.6.0 ZIP predates this field.

The version-1 review wrapper supports either report version in its exact `source_text` and SHA-256. Existing version-1 reports/reviews remain readable. There is no migration that rewrites an old source snapshot.

Primary endpoints: [HN Search API](https://hn.algolia.com/api), [official HN item API](https://github.com/HackerNews/API#items).
