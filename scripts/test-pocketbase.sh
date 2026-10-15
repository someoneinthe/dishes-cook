#!/usr/bin/env bash
# Runs the sync scenarios (src/features/sync/sync-engine.pocketbase.test.ts) against a real,
# throwaway PocketBase: the version in server/pocketbase-version (or $POCKETBASE_VERSION), started
# empty with server/migrations. The binary is downloaded once into node_modules/.cache and checked
# against the release's checksums. Extra arguments go to Jest.
set -euo pipefail

cd "$(dirname "$0")/.."
version="${POCKETBASE_VERSION:-$(tr -d '[:space:]' < server/pocketbase-version)}"

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) echo "Unsupported system: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=amd64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) echo "Unsupported processor: $(uname -m)" >&2; exit 1 ;;
esac

cache="node_modules/.cache/pocketbase/$version"
binary="$cache/pocketbase"
if [[ ! -x "$binary" ]]; then
  archive="pocketbase_${version}_${os}_${arch}.zip"
  release="https://github.com/pocketbase/pocketbase/releases/download/v$version"
  mkdir -p "$cache"
  echo "Downloading PocketBase $version ($os/$arch)…"
  curl --fail --silent --show-error --location --output "$cache/$archive" "$release/$archive"
  curl --fail --silent --show-error --location --output "$cache/checksums.txt" "$release/checksums.txt"
  (cd "$cache" && grep " $archive\$" checksums.txt | shasum -a 256 --check --status) || {
    echo "Checksum mismatch for $archive" >&2
    rm -rf "$cache"
    exit 1
  }
  unzip -q -o "$cache/$archive" pocketbase -d "$cache"
  rm "$cache/$archive"
fi

work="$(mktemp -d)"
server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT

port="$(node -e 'const s = require("node:net").createServer().listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close(); })')"
# A throwaway superuser, only for this run: the tests use it to create the phones' account and to
# empty the collections between scenarios.
superuser_email="superuser@example.org"
superuser_password="$(node -e 'console.log(require("node:crypto").randomBytes(18).toString("base64url"))')"

"$binary" superuser upsert "$superuser_email" "$superuser_password" --dir "$work/pb_data" > /dev/null
"$binary" serve --dir "$work/pb_data" --migrationsDir server/migrations --http "127.0.0.1:$port" \
  > "$work/pocketbase.log" 2>&1 &
server_pid=$!

url="http://127.0.0.1:$port"
is_up=false
for _ in $(seq 1 50); do
  if curl --fail --silent "$url/api/health" > /dev/null; then
    is_up=true
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    break
  fi
  sleep 0.2
done
if [[ "$is_up" != true ]]; then
  echo "PocketBase didn't start:" >&2
  cat "$work/pocketbase.log" >&2
  exit 1
fi
echo "PocketBase $version on $url"

POCKETBASE_URL="$url" \
  POCKETBASE_SUPERUSER_EMAIL="$superuser_email" \
  POCKETBASE_SUPERUSER_PASSWORD="$superuser_password" \
  npx jest --ci src/features/sync/sync-engine.pocketbase.test.ts "$@" ||
  {
    status=$?
    echo "--- PocketBase log" >&2
    cat "$work/pocketbase.log" >&2
    exit "$status"
  }
