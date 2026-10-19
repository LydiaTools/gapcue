# GapCue design and acceptance

Audience: indie builders, developer advocates and researchers reading public GitHub threads before choosing a product task. The first customer is our own issue-research workflow. External adoption and Star conversion remain unproven.

The job is to keep the request, later discussion, source coverage and a human decision together. Collectors already exist: gh-research is an agent-oriented research CLI; ghscout clusters and scores issues; GitHub Opportunity Miner synthesizes opportunity cards. GapCue is a small read-only collector and a local human review desk. It does not claim an empty market, a new inference engine or a prediction of demand.

## Visual direction

An early cream/serif research-board concept was rejected during design review: it repeated a common generated dashboard treatment. The selected direction is a cool lilac research folio, with a tabbed issue index, a spacious reading surface and a separate writable decision margin.

- Base `#faf9fc`, reading paper `#ffffff`, ink `#30283d`, folio lilac `#ece7f4`, source blue `#3558a6`, decision green `#466346`, error rose `#a33c50`.
- Avenir Next / Segoe UI for navigation and controls. Charter / Georgia for the short headline and collected prose. System monospace only for actual commands and raw identifiers.
- Desktop: index → source reading pane → decision margin. Mobile: issue index, selected thread, then decision. One conspicuous sample/partial-collection strip; no popularity score tiles or gradients.
- The memorable element is the visible gap between the first and last comment pages. It communicates missing source material rather than decorating a timeline.
- Source excerpts stay plain text. Source language is preserved when the interface language changes. No remote fonts, analytics, API keys or automatic report persistence in the viewer.

## Qualified result

1. Public GitHub metadata is checked before thread content. Production collection uses GET only, with bounded issues/comments/reference checks, explicit sample coverage and new output directories.
2. Mentioned PR state is read from GitHub; a closed issue is not called solved, and a merged PR is not called released. Failed sources remain unavailable and the report becomes partial.
3. A local JSON reader exposes the collected sources, author/bot metadata, sample gaps and a manual decision. English/Chinese controls, inert source text, bounded imports and a downloadable review are required.
4. Python/JS unit cases, CLI fault cases, actual public intake and real desktop/mobile browser operation must pass. The published source, Pages and actual release ZIP are checked separately.
5. Promotion describes a preview, uses real UI with clearly marked fictional demo data, and claims neither adoption nor future Stars. Personal LydiaTools only.
