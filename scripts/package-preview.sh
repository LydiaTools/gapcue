#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"
version="$(node -p "require('./package.json').version")"
tag="v${version}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to package a dirty working tree." >&2
  exit 1
fi
if ! git rev-parse --verify --quiet "refs/tags/${tag}" >/dev/null; then
  echo "Missing release tag ${tag}." >&2
  exit 1
fi
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "${tag}^{commit}")" ]]; then
  echo "HEAD must be the exact commit tagged ${tag}." >&2
  exit 1
fi

out_dir="${1:-dist}"
mkdir -p "$out_dir"
zip_path="${out_dir}/gapcue-${tag}-preview.zip"
sums_path="${out_dir}/SHA256SUMS.txt"
git archive --format=zip --prefix=gapcue/ "$tag" > "$zip_path"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$out_dir" && sha256sum "$(basename "$zip_path")" > "$(basename "$sums_path")")
else
  (cd "$out_dir" && shasum -a 256 "$(basename "$zip_path")" > "$(basename "$sums_path")")
fi
printf 'Created %s\n' "$zip_path"
printf 'Created %s\n' "$sums_path"
