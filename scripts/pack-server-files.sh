#!/usr/bin/env bash
# Packs the sync server's files (server/migrations and server/hooks, and the web app exported into
# <web folder>, as public/) into <archive>.tar.gz, with its SHA-256 next to it
# (<archive>.tar.gz.sha256), for the server's updater (see docs/sync.md › Updating the server). Used
# by the release workflow and by `npm run server:deploy`. Paths are from the repository's root.
# The archive's VERSION file ("<commit time> <commit>") keeps the updater from installing files
# older than the ones it has.
set -euo pipefail

usage='Usage: scripts/pack-server-files.sh <path/server-files.tar.gz> <web folder>'
archive="${1:?$usage}"
web="${2:?$usage}"
cd "$(dirname "$0")/.."
if [[ ! -f "$web/index.html" ]]; then
  echo "pack-server-files: no web app in $web (npm run web:export -- --output-dir $web)" >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git log -1 --format='%ct %h' > "$work/VERSION"
cp -R "$web" "$work/public"

mkdir -p "$(dirname "$archive")"
# No macOS metadata ("._name" files, extended attributes) in the archive when packed on a Mac.
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$archive" -C server migrations hooks \
  -C "$work" VERSION public
# Relative name in the checksum file: `sha256sum --check` runs next to the archive.
# sha256sum on Linux (CI), shasum on macOS: the same output.
if command -v sha256sum > /dev/null; then
  checksum=(sha256sum)
else
  checksum=(shasum -a 256)
fi
(cd "$(dirname "$archive")" && "${checksum[@]}" "$(basename "$archive")" > "$(basename "$archive").sha256")
