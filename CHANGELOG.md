# Changelog

## 0.3.0 · coding-agent research entry

Adds a self-contained `gapcue` Agent Skill and a dependency-free Node CLI for HN search, one public GitHub/HN discussion, and local review decisions. The CLI reuses the existing browser adapters and source-preserving review format. It reserves fresh output directories before network access, writes checksums, distinguishes partial/unavailable reads, and keeps old source bytes and other decisions when adding a review.

The existing browser and optional Python workflows remain available. Skill installation and deterministic execution are developer validation, not an agent-selection benchmark, marketplace approval or external adoption.

## 0.2.0 · browser research preview

A visitor can now collect a real discussion without running Python: search HN by topic and period, or paste a public HN/GitHub Issue URL. Read bounded comment samples and current mentioned GitHub states, then save the source snapshot beside a personal decision. HN threads have their own source format, counts and parent links; no GitHub issue state or demand score is invented.

English/Chinese browser controls, cancellable anonymous GET reads, failure/late-result protection, old-review support and standalone file viewing are included. Runtime/source limits and measured acceptance are in [validation](docs/VALIDATION.md). This remains an early preview.

## 0.1.0

Original standard-library GitHub collector, bounded first/last comment sampling, mentioned issue/PR checks, bilingual local review desk and downloadable source/decision bundles.
