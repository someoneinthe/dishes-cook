#!/usr/bin/env bash
# Packs the sync server's files (server/migrations and server/hooks) into <archive>.tar.gz, with
# its SHA-256 next to it (<archive>.tar.gz.sha256), for the server's updater (see docs/sync.md ›
# Updating the server). Used by the release workflow and by `npm run server:deploy`.
# The archive's VERSION file ("<commit time> <commit>") keeps the updater from installing files
# older than the ones it has.
set -euo pipefail

archive="${1:?Usage: scripts/pack-server-files.sh <path/server-files.tar.gz>}"
cd "$(dirname "$0")/.."

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git log -1 --format='%ct %h' > "$work/VERSION"

mkdir -p "$(dirname "$archive")"
# No macOS metadata ("._name" files, extended attributes) in the archive when packed on a Mac.
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$archive" -C server migrations hooks -C "$work" VERSION
# Relative name in the checksum file: `sha256sum --check` runs next to the archive.
(cd "$(dirname "$archive")" && shasum -a 256 "$(basename "$archive")" > "$(basename "$archive").sha256")
