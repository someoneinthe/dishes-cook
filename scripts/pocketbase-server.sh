# Sourced by test-pocketbase.sh and test-e2e.sh: starts a throwaway PocketBase for tests, stopped
# and deleted when the calling script exits. The version is server/pocketbase-version's (or
# $POCKETBASE_VERSION), downloaded once into node_modules/.cache and checked against the release's
# checksums; it starts empty with server/migrations on a free local port.
# Sets POCKETBASE_URL, POCKETBASE_PORT and a throwaway superuser (POCKETBASE_SUPERUSER_EMAIL and
# POCKETBASE_SUPERUSER_PASSWORD) that tests use to set the server up.

pocketbase_version="${POCKETBASE_VERSION:-$(tr -d '[:space:]' < server/pocketbase-version)}"

pocketbase_binary() {
  local os arch cache archive release
  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *) echo "Unsupported system: $(uname -s)" >&2; return 1 ;;
  esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=amd64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) echo "Unsupported processor: $(uname -m)" >&2; return 1 ;;
  esac

  cache="node_modules/.cache/pocketbase/$pocketbase_version"
  if [[ ! -x "$cache/pocketbase" ]]; then
    archive="pocketbase_${pocketbase_version}_${os}_${arch}.zip"
    release="https://github.com/pocketbase/pocketbase/releases/download/v$pocketbase_version"
    mkdir -p "$cache"
    echo "Downloading PocketBase $pocketbase_version ($os/$arch)…" >&2
    curl --fail --silent --show-error --location --output "$cache/$archive" "$release/$archive"
    curl --fail --silent --show-error --location --output "$cache/checksums.txt" "$release/checksums.txt"
    (cd "$cache" && grep " $archive\$" checksums.txt | shasum -a 256 --check --status) || {
      echo "Checksum mismatch for $archive" >&2
      rm -rf "$cache"
      return 1
    }
    unzip -q -o "$cache/$archive" pocketbase -d "$cache"
    rm "$cache/$archive"
  fi
  echo "$cache/pocketbase"
}

pocketbase_work="$(mktemp -d)"
pocketbase_pid=""
stop_pocketbase() {
  if [[ -n "$pocketbase_pid" ]]; then
    kill "$pocketbase_pid" 2>/dev/null || true
    wait "$pocketbase_pid" 2>/dev/null || true
  fi
  rm -rf "$pocketbase_work"
}
trap stop_pocketbase EXIT

# Prints the server's log (when a test fails).
pocketbase_log() {
  echo "--- PocketBase log" >&2
  cat "$pocketbase_work/pocketbase.log" >&2
}

start_pocketbase() {
  local binary
  binary="$(pocketbase_binary)"
  POCKETBASE_PORT="$(node -e 'const s = require("node:net").createServer().listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close(); })')"
  POCKETBASE_URL="http://127.0.0.1:$POCKETBASE_PORT"
  POCKETBASE_SUPERUSER_EMAIL="superuser@example.org"
  POCKETBASE_SUPERUSER_PASSWORD="$(node -e 'console.log(require("node:crypto").randomBytes(18).toString("base64url"))')"
  export POCKETBASE_PORT POCKETBASE_URL POCKETBASE_SUPERUSER_EMAIL POCKETBASE_SUPERUSER_PASSWORD

  "$binary" superuser upsert "$POCKETBASE_SUPERUSER_EMAIL" "$POCKETBASE_SUPERUSER_PASSWORD" \
    --dir "$pocketbase_work/pb_data" > /dev/null
  "$binary" serve --dir "$pocketbase_work/pb_data" --migrationsDir server/migrations \
    --hooksDir server/hooks \
    --http "127.0.0.1:$POCKETBASE_PORT" > "$pocketbase_work/pocketbase.log" 2>&1 &
  pocketbase_pid=$!

  for _ in $(seq 1 50); do
    if curl --fail --silent "$POCKETBASE_URL/api/health" > /dev/null; then
      echo "PocketBase $pocketbase_version on $POCKETBASE_URL"
      return 0
    fi
    if ! kill -0 "$pocketbase_pid" 2>/dev/null; then
      break
    fi
    sleep 0.2
  done
  pocketbase_log
  return 1
}
