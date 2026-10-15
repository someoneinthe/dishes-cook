#!/usr/bin/env bash
# Runs on the sync server, as root: installs the server files of a dishes-cook version (PocketBase
# migrations and hooks), see docs/sync.md › Updating the server.
#
#   update-server.sh                     the latest GitHub release's server-files.tar.gz, checked
#                                        against its .sha256 (what the hourly timer runs)
#   update-server.sh --archive <file>    a given archive (`npm run server:deploy`)
#
# Nothing happens when the server already has these files. Otherwise PocketBase is stopped, its
# data backed up, the new files installed, and PocketBase started again; if it doesn't come back
# healthy, the data and files are put back as they were. An installed migration that differs from
# the archive's stops everything: migrations are never edited (PocketBase wouldn't re-run them).
set -euo pipefail

repo="${DISHES_COOK_REPO:-someoneinthe/dishes-cook}"
pb_dir="${PB_DIR:-/opt/pocketbase}"
pb_service="${PB_SERVICE:-pocketbase}"
pb_user="${PB_USER:-pocketbase}"
health_url="${PB_HEALTH_URL:-http://127.0.0.1:8090/api/health}"
backup_dir="$pb_dir/backups-before-update"
backups_kept=5

log() { echo "update-server: $*"; }

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
  archive="$work/server-files.tar.gz"
fi
mkdir "$work/files"
tar -xzf "$archive" -C "$work/files"

# What's new: migrations not installed yet, hooks new or changed.
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
if (( ${#new_migration_list[@]} == 0 && ${#changed_hook_list[@]} == 0 )); then
  log "up to date"
  exit 0
fi
log "installing migrations: ${new_migration_list[*]:-none}; hooks: ${changed_hook_list[*]:-none}"

is_healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS "$health_url" > /dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

systemctl stop "$pb_service"
mkdir -p "$backup_dir" "$pb_dir/pb_migrations" "$pb_dir/pb_hooks"
backup="$backup_dir/pb_data-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$backup" -C "$pb_dir" pb_data
cp -a "$pb_dir/pb_hooks" "$work/previous_hooks"

for name in "${new_migration_list[@]}"; do
  install -o "$pb_user" -g "$pb_user" -m 644 "$work/files/migrations/$name" "$pb_dir/pb_migrations/"
done
for name in "${changed_hook_list[@]}"; do
  install -o "$pb_user" -g "$pb_user" -m 644 "$work/files/hooks/$name" "$pb_dir/pb_hooks/"
done
systemctl start "$pb_service"

if is_healthy; then
  # Oldest backups first out.
  find "$backup_dir" -name 'pb_data-*.tar.gz' | sort | head -n "-$backups_kept" | xargs -r rm -f
  log "done (data backed up in $backup)"
  exit 0
fi

log "PocketBase didn't come back healthy: putting the previous data and files back"
systemctl stop "$pb_service"
rm -rf "$pb_dir/pb_data"
tar -xzf "$backup" -C "$pb_dir"
for name in "${new_migration_list[@]}"; do
  rm -f "$pb_dir/pb_migrations/$name"
done
rm -rf "$pb_dir/pb_hooks"
cp -a "$work/previous_hooks" "$pb_dir/pb_hooks"
systemctl start "$pb_service"
if is_healthy; then
  log "rolled back: PocketBase runs as before the update"
else
  log "rolled back, but PocketBase still isn't healthy: check \`journalctl -u $pb_service\`"
fi
exit 1
