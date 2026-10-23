#!/usr/bin/env bash
# Runs on the sync server, as root: installs the server files of a dishes-cook version (PocketBase
# migrations and hooks), see docs/sync.md › Updating the server.
#
#   update-server.sh                     the latest GitHub release's server-files.tar.gz, installed
#                                        only if its attestation proves the repo's release workflow
#                                        built it on main (what the hourly timer runs)
#   update-server.sh --archive <file>    a given archive (`npm run server:deploy`)
#
# Nothing happens when the server already has these files, or newer ones (an archive is never
# installed over newer files: e.g. a release older than a manual deploy from main). Otherwise
# PocketBase is stopped, its data backed up, the new files installed, and PocketBase started again;
# on any failure from then on, or if PocketBase doesn't come back healthy, the data and files are
# put back as they were. An installed migration that differs from the archive's stops everything:
# migrations are never edited (PocketBase wouldn't re-run them).
set -euEo pipefail
# An empty folder gives no file to loop over, not a literal "*.js".
shopt -s nullglob

repo="${DISHES_COOK_REPO:-someoneinthe/dishes-cook}"
pb_dir="${PB_DIR:-/opt/pocketbase}"
pb_service="${PB_SERVICE:-pocketbase}"
pb_user="${PB_USER:-pocketbase}"
health_url="${PB_HEALTH_URL:-http://127.0.0.1:8090/api/health}"
lock_file="${UPDATE_LOCK:-/run/lock/dishes-cook-update-server.lock}"
backup_dir="$pb_dir/backups-before-update"
version_file="$pb_dir/server-files.version"
backups_kept=5
# What signs a release's server files: the repo's release workflow, run on main by GitHub Actions.
signer="https://github.com/$repo/.github/workflows/release.yml@refs/heads/main"
signer_issuer="https://token.actions.githubusercontent.com"
# cosign checks that signature (Sigstore). This version, from its GitHub release, checked against
# the checksums of its release (cosign_checksums.txt).
cosign_version=3.1.3
declare -A cosign_sha256=(
  [amd64]=4629c757b7618056f8ddd7e2625ae9fdd94c0372a65049520bc7d9df9efc7f71
  [arm64]=c5d324e091826b0d7a78eb16fef316450b4eb9aaec045611c08ba06f5e73220a
)
cosign="/usr/local/lib/dishes-cook-update/cosign-$cosign_version"

log() { echo "update-server: $*"; }

# Installs this script's cosign once, refusing a download that doesn't match its checksum.
install_cosign() {
  if [[ -x "$cosign" ]]; then
    return
  fi
  local arch
  case "$(uname -m)" in
    x86_64) arch=amd64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *)
      log "no cosign for this processor ($(uname -m)): can't check the release's attestation"
      exit 1
      ;;
  esac
  curl -fsSL -o "$work/cosign" \
    "https://github.com/sigstore/cosign/releases/download/v$cosign_version/cosign-linux-$arch"
  if ! echo "${cosign_sha256[$arch]}  $work/cosign" | sha256sum --check --quiet; then
    log "refusing cosign $cosign_version: its checksum doesn't match"
    exit 1
  fi
  install -D -m 755 "$work/cosign" "$cosign"
}

# One update at a time: the timer and a manual deploy can start together.
exec 9> "$lock_file"
if ! flock -w 900 9; then
  log "another update is still running"
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [[ "${1:-}" == "--archive" ]]; then
  archive="${2:?--archive needs a file}"
else
  release="https://github.com/$repo/releases/latest/download"
  if ! curl -fsL -o "$work/server-files.tar.gz" "$release/server-files.tar.gz"; then
    log "no server files in the latest release of $repo"
    exit 0
  fi
  curl -fsSL -o "$work/server-files.tar.gz.sha256" "$release/server-files.tar.gz.sha256"
  (cd "$work" && sha256sum --check --quiet server-files.tar.gz.sha256)
  # Anyone able to publish a release could put files there: only the release workflow, run on
  # main, can sign their attestation (release.yml).
  if ! curl -fsSL -o "$work/server-files.tar.gz.sigstore.json" \
    "$release/server-files.tar.gz.sigstore.json"; then
    log "refusing the latest release's server files: they have no attestation"
    exit 1
  fi
  install_cosign
  if ! "$cosign" verify-blob-attestation --type slsaprovenance1 \
    --bundle "$work/server-files.tar.gz.sigstore.json" \
    --certificate-identity "$signer" --certificate-oidc-issuer "$signer_issuer" \
    "$work/server-files.tar.gz" > "$work/cosign.log" 2>&1; then
    log "refusing the latest release's server files: their attestation doesn't check out"
    cat "$work/cosign.log"
    exit 1
  fi
  archive="$work/server-files.tar.gz"
fi
# Only plain files under migrations/ and hooks/, and VERSION: no links (cmp and install, as root,
# would follow them), devices or other paths.
if ! tar -tvzf "$archive" | awk '
  BEGIN { valid = 1; has_version = 0 }
  $1 ~ /^d/ && ($NF == "migrations/" || $NF == "hooks/") { next }
  $1 ~ /^-/ && $NF == "VERSION" { has_version = 1; next }
  $1 ~ /^-/ && $NF ~ /^(migrations|hooks)\/[^/]+$/ { next }
  { valid = 0 }
  END { exit !(valid && has_version) }
'; then
  log "refusing the archive: unexpected members (links, other paths) or no VERSION"
  exit 1
fi
mkdir "$work/files"
tar -xzf "$archive" -C "$work/files"

# VERSION: "<commit time> <commit>" of the files (scripts/pack-server-files.sh).
read -r archive_time archive_commit < "$work/files/VERSION" || true
if [[ ! "${archive_time:-}" =~ ^[0-9]+$ || -z "${archive_commit:-}" ]]; then
  log "refusing the archive: invalid VERSION"
  exit 1
fi
installed_time=0
installed_commit=none
if [[ -f "$version_file" ]]; then
  read -r installed_time installed_commit < "$version_file"
fi
if (( archive_time < installed_time )); then
  log "skipped: these files ($archive_commit) are older than the installed ones ($installed_commit)"
  exit 0
fi

# What's new: migrations not installed yet, hooks new, changed or removed.
new_migration_list=()
for file in "$work/files/migrations"/*.js; do
  name="$(basename "$file")"
  installed="$pb_dir/pb_migrations/$name"
  if [[ ! -e "$installed" ]]; then
    new_migration_list+=("$name")
  elif ! cmp -s "$file" "$installed"; then
    log "refusing to update: $name differs from the installed one (migrations are never edited)"
    exit 1
  fi
done
changed_hook_list=()
for file in "$work/files/hooks"/*.js; do
  name="$(basename "$file")"
  if ! cmp -s "$file" "$pb_dir/pb_hooks/$name" 2>/dev/null; then
    changed_hook_list+=("$name")
  fi
done
removed_hook_list=()
for file in "$pb_dir/pb_hooks"/*.js; do
  name="$(basename "$file")"
  if [[ -e "$file" && ! -e "$work/files/hooks/$name" ]]; then
    removed_hook_list+=("$name")
  fi
done
if (( ${#new_migration_list[@]} + ${#changed_hook_list[@]} + ${#removed_hook_list[@]} == 0 )); then
  echo "$archive_time $archive_commit" > "$version_file"
  log "up to date ($archive_commit)"
  exit 0
fi
log "installing $archive_commit: migrations ${new_migration_list[*]:-none};" \
  "hooks ${changed_hook_list[*]:-none}; removed hooks ${removed_hook_list[*]:-none}"

is_healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS "$health_url" > /dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Puts back the files (and the data, once PocketBase ran with the new files), then starts it.
is_data_changed=false
rollback() {
  trap - ERR
  log "putting the previous data and files back"
  systemctl stop "$pb_service" || true
  if [[ "$is_data_changed" == true ]]; then
    rm -rf "$pb_dir/pb_data"
    tar -xzf "$backup" -C "$pb_dir"
  fi
  for name in "${new_migration_list[@]}"; do
    rm -f "$pb_dir/pb_migrations/$name"
  done
  if [[ -d "$work/previous_hooks" ]]; then
    rm -rf "$pb_dir/pb_hooks"
    cp -a "$work/previous_hooks" "$pb_dir/pb_hooks"
  fi
  systemctl start "$pb_service" || true
  if is_healthy; then
    log "rolled back: PocketBase runs as before the update"
  else
    log "rolled back, but PocketBase still isn't healthy: check \`journalctl -u $pb_service\`"
  fi
  exit 1
}

systemctl stop "$pb_service"
# From here, any failing command rolls back (the ERR trap, with set -E for functions).
trap 'log "failed (line $LINENO)"; rollback' ERR
install -d -o "$pb_user" -g "$pb_user" -m 755 "$pb_dir/pb_migrations" "$pb_dir/pb_hooks"
# Backups hold the users' data (accounts included): readable by root only.
install -d -m 700 "$backup_dir"
backup="$backup_dir/pb_data-$(date +%Y%m%d-%H%M%S).tar.gz"
(umask 077 && tar -czf "$backup" -C "$pb_dir" pb_data)
cp -a "$pb_dir/pb_hooks" "$work/previous_hooks"

for name in "${new_migration_list[@]}"; do
  install -o "$pb_user" -g "$pb_user" -m 644 "$work/files/migrations/$name" "$pb_dir/pb_migrations/"
done
for name in "${changed_hook_list[@]}"; do
  install -o "$pb_user" -g "$pb_user" -m 644 "$work/files/hooks/$name" "$pb_dir/pb_hooks/"
done
for name in "${removed_hook_list[@]}"; do
  rm -f "$pb_dir/pb_hooks/$name"
done
# Starting applies the new migrations: from now on, the data may change.
is_data_changed=true
systemctl start "$pb_service"
if ! is_healthy; then
  log "PocketBase didn't come back healthy"
  rollback
fi
trap - ERR

echo "$archive_time $archive_commit" > "$version_file"
# Oldest backups first out.
find "$backup_dir" -name 'pb_data-*.tar.gz' | sort | head -n "-$backups_kept" | xargs -r rm -f
log "done (data backed up in $backup)"
