# Changelog

## 0.7.0 · Research developer questions

Search Stack Overflow questions by topic, open a question with up to 10 vote-sorted answers, and save a bounded review with the original excerpts. Each post links to its author and source, and shows the applicable CC BY-SA license. Search and answer reads are anonymous GET requests; source backoff and duplicate-search delays are respected. The review file is separate from the GitHub/Hacker News formats.

This preview includes the online research desk and current bilingual documentation. It is a source-reading tool, not a measure of demand.

## 0.6.2 · Find a repository from an HN discussion

From an HN story that points to a website, prepare an editable project-name search on GitHub and review candidate repositories. The starting discussion stays accessible during the search; name matches are not verified identities and are not saved with repository snapshots. Direct GitHub story links can also be checked on demand. These browser features and the current research cases are included in this preview.

## 0.6.1 · Keep the path from project to discussion

Find Hacker News discussions by name from a GitHub or AgentAtlas project result and return to the project list. A saved review retains the starting repository as an unverified search origin; a name match is not proof of a relationship. Existing reviews remain readable. This preview also includes the latest bilingual project documentation and research example.

## 0.6.0 · Compare repository observations

Save a bounded GitHub repository search as a local snapshot and compare two files in English or Chinese. Repository IDs align renamed projects; only entries present in both snapshots receive a Star difference. Capture times come from the device, files can be edited, and date filters or incomplete results can change the sample. Comparison also works offline; collecting a new snapshot requires GitHub access. The saved snapshot is distinct from a discussion review and is not a demand forecast.

## 0.5.0 · Discover and investigate

The browser desk can show AgentAtlas's attributed public snapshot of recently created agent projects. The list displays its generation time and the source's average Stars per day since creation; it is a discovery lead, not recent growth, user demand, or a saved review. AgentAtlas data is CC BY 4.0; descriptions may be shortened.

HN comments can display a parent on request. A parent already in the sample comes from the source snapshot; a live-read parent is not saved in the review. Public reads can fail or become stale. Existing saved reviews remain supported.

## 0.4.0 · Find repositories and investigate discussions

Adds bounded GitHub repository search to the browser desk and Agent Skill CLI. Results use current cumulative Stars and UTC creation dates, not Star growth or a demand forecast. The search excludes archived repositories and forks, identifies incomplete results, and links to repository issues for further research. License names are GitHub metadata and require checking the actual license and assets. Repository search is separate from a saved discussion review.

## 0.3.0 · coding-agent research entry

Adds a self-contained `gapcue` Agent Skill and a dependency-free Node CLI for HN search, one public GitHub/HN discussion, and local review decisions. The CLI reuses the existing browser adapters and source-preserving review format. It reserves fresh output directories before network access, writes checksums, distinguishes partial/unavailable reads, and keeps old source bytes and other decisions when adding a review.

The existing browser and optional Python workflows remain available. Skill installation and deterministic execution are developer validation, not an agent-selection benchmark, marketplace approval or external adoption.

## 0.2.0 · browser research preview

A visitor can now collect a real discussion without running Python: search HN by topic and period, or paste a public HN/GitHub Issue URL. Read bounded comment samples and current mentioned GitHub states, then save the source snapshot beside a personal decision. HN threads have their own source format, counts and parent links; no GitHub issue state or demand score is invented.

English/Chinese browser controls, cancellable anonymous GET reads, failure/late-result protection, old-review support and standalone file viewing are included. Runtime/source limits and measured acceptance are in [validation](docs/VALIDATION.md). This remains an early preview.

## 0.1.0

Original standard-library GitHub collector, bounded first/last comment sampling, mentioned issue/PR checks, bilingual local review desk and downloadable source/decision bundles.
