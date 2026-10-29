#!/usr/bin/env bash
# Runs on the sync server, as root: installs the server files of a dishes-cook version (PocketBase
# migrations and hooks, and the web app PocketBase serves), see docs/sync.md › Updating the server.
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
# The updater's own files, root-only: in $pb_dir, which PocketBase's user may own, that user could
# swap them for links (root would then write or delete elsewhere) or forge the installed version.
state_dir="${UPDATE_STATE_DIR:-/var/lib/dishes-cook-update}"
backup_dir="$state_dir/backups-before-update"
version_file="$state_dir/server-files.version"
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
# A backup still being written (backup_part below) goes too when the update stops halfway.
backup_part=''
trap 'rm -rf "$work"; [[ -z "$backup_part" ]] || rm -f -- "$backup_part"' EXIT

if [[ -L "$state_dir" ]]; then
  log "refusing to update: $state_dir is a link"
  exit 1
fi
install -d -o root -g root -m 700 "$state_dir"
# Updaters before this one kept these files in $pb_dir: moved once. The version is kept only if
# PocketBase's user can't have written it (a plain file of root's, writable by root only: they
# wrote it so) and it reads right; otherwise there's none, and the archive is installed. A forged
# future version would make the updater skip every release.
legacy_version_file="$pb_dir/server-files.version"
if [[ ! -e "$version_file" && -e "$legacy_version_file" ]]; then
  old_time=''
  old_commit=''
  if [[ -n "$(find "$legacy_version_file" -maxdepth 0 -type f -user root ! -perm /022)" ]]; then
    read -r old_time old_commit < "$legacy_version_file" || true
  fi
  if [[ "${old_time:-}" =~ ^[0-9]+$ && "${old_commit:-}" =~ ^[0-9a-f]+$ ]]; then
    echo "$old_time $old_commit" > "$version_file"
  fi
  if [[ -f "$legacy_version_file" || -L "$legacy_version_file" ]]; then
    rm -f "$legacy_version_file"
  else
    log "ignoring $legacy_version_file: not a file"
  fi
fi
if [[ ! -e "$backup_dir" && -d "$pb_dir/backups-before-update" && ! -L "$pb_dir/backups-before-update" ]]; then
  mv "$pb_dir/backups-before-update" "$backup_dir"
  chown -R root:root "$backup_dir"
  chmod 700 "$backup_dir"
fi

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
# Only plain files under migrations/ and hooks/, folders and plain files under public/ (the web
# app, names of letters, digits and ._@+- only, never "." or ".."), and VERSION: no links (cmp and
# install, as root, would follow them), devices or other paths.
if ! tar -tvzf "$archive" | awk '
  BEGIN { valid = 1; has_version = 0 }
  $1 ~ /^d/ && ($NF == "migrations/" || $NF == "hooks/") { next }
  $1 ~ /^-/ && $NF == "VERSION" { has_version = 1; next }
  $1 ~ /^-/ && $NF ~ /^(migrations|hooks)\/[^/]+$/ { next }
  $NF ~ /(^|\/)\.\.?(\/|$)/ { valid = 0; next }
  $1 ~ /^d/ && $NF ~ /^public\/([[:alnum:]_@.+-]+\/)*$/ { next }
  $1 ~ /^-/ && $NF ~ /^public\/([[:alnum:]_@.+-]+\/)*[[:alnum:]_@.+-]+$/ { next }
  { valid = 0 }
  END { exit !(valid && has_version) }
'; then
  log "refusing the archive: unexpected members (links, other paths) or no VERSION"
  exit 1
fi
mkdir "$work/files"
tar -xzf "$archive" -C "$work/files"
# A web app without its page would replace a working one with nothing to open.
if [[ -d "$work/files/public" && ! -f "$work/files/public/index.html" ]]; then
  log "refusing the archive: its web app has no index.html"
  exit 1
fi

# VERSION: "<commit time> <commit>" of the files (scripts/pack-server-files.sh).
read -r archive_time archive_commit < "$work/files/VERSION" || true
if [[ ! "${archive_time:-}" =~ ^[0-9]+$ || ! "${archive_commit:-}" =~ ^[0-9a-f]+$ ]]; then
  log "refusing the archive: invalid VERSION"
  exit 1
fi
installed_time=0
installed_commit=none
if [[ -L "$version_file" || (-e "$version_file" && ! -f "$version_file") ]]; then
  log "refusing to update: $version_file isn't a file"
  exit 1
fi
if [[ -f "$version_file" ]]; then
  read -r installed_time installed_commit < "$version_file" || true
  # Checked before any use: bash would run a command written in an arithmetic expression.
  if [[ ! "${installed_time:-}" =~ ^[0-9]+$ || ! "${installed_commit:-}" =~ ^[0-9a-f]+$ ]]; then
    log "refusing to update: $version_file is invalid"
    exit 1
  fi
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
# PocketBase's folders must be folders, not links, even when nothing is installed: a linked
# pb_public matching the archive would otherwise pass as up to date. Checked again once PocketBase
# is stopped, before installing.
for name in pb_data pb_migrations pb_hooks pb_public; do
  if [[ -L "$pb_dir/$name" || (-e "$pb_dir/$name" && ! -d "$pb_dir/$name") ]]; then
    log "refusing to update: $pb_dir/$name isn't a folder"
    exit 1
  fi
done
# A web app swap cut short (see the install below) left the old one set aside: put back first,
# whatever this archive holds.
if [[ ! -e "$pb_dir/pb_public" && -d "$pb_dir/pb_public.old" && ! -L "$pb_dir/pb_public.old" ]]; then
  mv -T "$pb_dir/pb_public.old" "$pb_dir/pb_public"
fi
# The web app (public/, PocketBase's pb_public/), replaced whole when it differs. An archive without
# one (from before the web app) leaves the installed one.
is_public_changed=false
if [[ -d "$work/files/public" ]] && ! diff -rq "$work/files/public" "$pb_dir/pb_public" > /dev/null 2>&1; then
  is_public_changed=true
fi
if (( ${#new_migration_list[@]} + ${#changed_hook_list[@]} + ${#removed_hook_list[@]} == 0 )) &&
  [[ "$is_public_changed" == false ]]; then
  echo "$archive_time $archive_commit" > "$version_file"
  log "up to date ($archive_commit)"
  exit 0
fi
log "installing $archive_commit: migrations ${new_migration_list[*]:-none};" \
  "hooks ${changed_hook_list[*]:-none}; removed hooks ${removed_hook_list[*]:-none};" \
  "web app $([[ "$is_public_changed" == true ]] && echo changed || echo unchanged)"

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
is_public_installed=false
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
  if [[ "$is_public_installed" == true ]]; then
    rm -rf "$pb_dir/pb_public"
    if [[ -d "$work/previous_public" ]]; then
      cp -a "$work/previous_public" "$pb_dir/pb_public"
    fi
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
# PocketBase's folders must be folders, not links that would make root write, copy or delete
# elsewhere. Checked with PocketBase stopped: its user can't change them any more meanwhile.
for name in pb_data pb_migrations pb_hooks pb_public; do
  if [[ -L "$pb_dir/$name" || (-e "$pb_dir/$name" && ! -d "$pb_dir/$name") ]]; then
    log "refusing to update: $pb_dir/$name isn't a folder"
    if ! systemctl start "$pb_service" || ! is_healthy; then
      log "PocketBase didn't come back healthy: check \`journalctl -u $pb_service\`"
    fi
    exit 1
  fi
done
# From here, any failing command rolls back (the ERR trap, with set -E for functions).
trap 'log "failed (line $LINENO)"; rollback' ERR
install -d -o "$pb_user" -g "$pb_user" -m 755 "$pb_dir/pb_migrations" "$pb_dir/pb_hooks"
# Backups hold the users' data (accounts included): readable by root only.
install -d -m 700 "$backup_dir"
backup="$backup_dir/pb_data-$(date +%Y%m%d-%H%M%S).tar.gz"
# Written to a new private file, then renamed: a link already at that name (moved from an earlier
# updater's folder) is replaced, never written through.
backup_part="$(mktemp "$backup_dir/.pb_data.XXXXXX")"
tar -czf "$backup_part" -C "$pb_dir" pb_data
mv -fT "$backup_part" "$backup"
backup_part=''
cp -a "$pb_dir/pb_hooks" "$work/previous_hooks"

# A file is replaced, never written through: removed first, in case it's a link.
for name in "${new_migration_list[@]}"; do
  rm -f "$pb_dir/pb_migrations/$name"
  install -o "$pb_user" -g "$pb_user" -m 644 "$work/files/migrations/$name" "$pb_dir/pb_migrations/"
done
for name in "${changed_hook_list[@]}"; do
  rm -f "$pb_dir/pb_hooks/$name"
  install -o "$pb_user" -g "$pb_user" -m 644 "$work/files/hooks/$name" "$pb_dir/pb_hooks/"
done
for name in "${removed_hook_list[@]}"; do
  rm -f "$pb_dir/pb_hooks/$name"
done
# The web app: root's, which PocketBase only reads (its user can't change what browsers run). Copied
# beside pb_public first, then swapped in by renames (same folder, same file system): an update cut
# short (killed, power loss) never leaves a half-copied web app, at most the old one set aside in
# pb_public.old, which the next run puts back (before anything else). `rm -rf` on a link removes
# the link only.
if [[ "$is_public_changed" == true ]]; then
  rm -rf "$pb_dir/pb_public.new" "$pb_dir/pb_public.old"
  cp -R "$work/files/public" "$pb_dir/pb_public.new"
  chown -R root:root "$pb_dir/pb_public.new"
  chmod -R u=rwX,go=rX "$pb_dir/pb_public.new"
  if [[ -d "$pb_dir/pb_public" ]]; then
    cp -a "$pb_dir/pb_public" "$work/previous_public"
    mv -T "$pb_dir/pb_public" "$pb_dir/pb_public.old"
  fi
  # From here a rollback replaces pb_public: only once its copy is safe in previous_public.
  is_public_installed=true
  mv -T "$pb_dir/pb_public.new" "$pb_dir/pb_public"
  rm -rf "$pb_dir/pb_public.old"
fi
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
