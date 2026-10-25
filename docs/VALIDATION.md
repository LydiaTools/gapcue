# Preview validation · 2026-10-20

Scope: original local code, deterministic fictional fixtures, and small public GitHub collections. This record is developer validation, not independent adoption or a comparison benchmark.

## Automated checks

- 14 Python cases: public/private gating; first/last comment gaps and bot identity; partial page failure; merged versus closed PRs; reference budgets; patch links; case-variant deduplication; Markdown label escaping; PR seed rejection; single-repo search/incomplete results; invalid targets; refusal to overwrite output; GET-only argument-array `gh` backend; no stale fallback.
- 8 JavaScript core cases: report facts stay separate; source/notes round trip; changed source detection; invalid/foreign decisions; duplicate issue keys; unsafe URLs; Unicode excerpt lengths; failures and duplicate comments.
- 8 browser workflow groups: visibly fictional sample; actual review download/reopen; declined replacement preserving notes; inert hostile source/malformed input rejection; partial-read display; bilingual controls; mobile-sized selection/layout; direct `file://` download. The test asserts zero unexpected HTTP requests and zero page errors.

Commands are in the root README. The initial macOS run used installed Chrome 155.0.8059.84. The phone check is a 390×844 browser viewport, not an acceptance test on a physical phone. CI runs the same fictional browser checks with Playwright Chromium; inspect [Actions](https://github.com/LydiaTools/gapcue/actions) for the actual current run result.

## Public intake exercised

- `openai/openai-python#4022` and `#4063`: explicit collection through the existing GitHub CLI backend; first/last-page omissions, referenced issue/PR states and fork patch links were retained separately.
- `obsidianmd/pele#35`: anonymous public backend, no reference reads.
- `obsidianmd/pele`, query `layout`: bounded two-issue search through `gh`, no reference reads.

All three requested collections completed without reported source failures at the time of these checks. They demonstrate collection, not reproduction or resolution of any upstream bug. Real raw reports, author excerpts, reviewer notes, account configuration and private operations records are **not bundled** in this repository. States and counts can change afterward.

## Remaining limits

No production account writes, model calls, paid-provider calls, private-repository intake, fix execution, release validation or automatic opportunity judgments were tested or implemented. Firefox/Safari, a physical phone, independent user feedback, acquisition conversion and revenue remain unverified. A successful collector run does not close those gaps.


## v0.2 browser collection · 2026-10-25

The expanded browser path was exercised with installed Chrome 156.0.8078.47 against anonymous real endpoints, separate from the controlled-API test harness. [Machine-readable scope and runtime hashes](browser-validation.json).

- HN keyword search with a 90-day period and exact typo/word-removal settings selected the public Corgi terminal story. At the recorded read, 13 of 43 comments were collected from the newest/oldest indexed pages. Source event times, index counts and collection times remain separate. The actual downloaded review retained its search query, source snapshot, decision and notes after closing the tab, opening the app through file:// and importing disconnected.
- A public GitHub browser collection of `microsoft/markitdown#293` read its issue and comments. A separate `openai/openai-python#4022` collection read 13 of 23 comments from pages 1 and 3 and checked the mentioned `#3201` issue (closed) and `#3709` PR (open) from the API. These are dated source states, not fix/release verdicts. The downloaded source hash was independently checked.
- Captured API requests were GET-only, without Cookie, Authorization or referrer information. The page made no source request before an explicit user action. Network failures and limits remain possible; one successful run is not universal API availability.
- The controlled API harness separately exercises rate limits, one failed GitHub comment page, stopping a pending read, a late older search response, no overwritten notes, inert source HTML and old-report compatibility. It is explicitly synthetic test evidence. Current command results are available in [Actions](https://github.com/LydiaTools/gapcue/actions).
- English and Chinese desktop captures plus a 390px Chinese viewport were inspected. Published new search images show a real HN result above the labeled original fictional review sample. They do not portray an external user or an endorsement. No cursor overlay or fabricated engagement was added.

The first local browser attempts exposed a missing development dependency and missing preview-server routes for the new scripts. The existing Playwright runtime was reused and every declared script route now has a regression check. A real Chrome request represented an omitted referrer as an empty value; the privacy check now measures whether information is present rather than requiring a particular absent-header representation. Failed checks were corrected before release.

Original version-1 source bytes and saved reviews remain supported; HN uses a distinct version-2 thread format. Private raw collection files and reviewer notes are not part of the release. Live source collection and developer/CI success are not independent use, Star growth or demand validation.
