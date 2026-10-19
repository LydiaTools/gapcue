# Contributing

Small fixes to source coverage, incorrect state labels, import/export and reading accessibility are especially useful.

For a bug, include your Python/browser version, the command with private paths removed, expected/actual behavior, and a minimal **fictional or redacted** report if necessary. Do not attach credentials, unsanitized reviewer notes or private issue contents. If the report is partial, keep its failure status visible in a reproduction.

Run the Python/core/browser checks in the README. Prefer a focused regression case when changing collection or report semantics. Keep runtime Python dependency-free and the viewer usable without a build step. Generated fictional fixtures come from `scripts/build-sample.py`.

Please preserve these distinctions: a source sample is not a complete thread; handles are not verified independent people; open is not unmet; merged is not released. Proposed scoring or AI features need a clear, separately testable purpose rather than an implied demand prediction.
