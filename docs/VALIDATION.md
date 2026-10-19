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
