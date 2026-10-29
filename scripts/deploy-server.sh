#!/usr/bin/env bash
# Deploys this checkout's server files (server/migrations, server/hooks, and the web app it serves)
# to the sync server over SSH, and installs or refreshes its updater and hourly timer (see
# docs/sync.md › Updating the server). SYNC_SERVER_SSH is the server's SSH login (user@host, with
# sudo there).
#
# Only from an up-to-date main with no local change (FORCE=1 to deploy anyway, e.g. a test server):
# PocketBase never re-runs a migration it applied, so a migration deployed from a branch and edited
# before merging would never reach the server in its final form; and the web app is built from the
# whole checkout, so any change (untracked files too) would ship under main's version.
set -euo pipefail

cd "$(dirname "$0")/.."
: "${SYNC_SERVER_SSH:?Set SYNC_SERVER_SSH to the SSH login of the sync server, e.g. user@host}"

if [[ "${FORCE:-}" != 1 ]]; then
  git fetch --quiet origin main
  if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]] ||
    [[ -n "$(git status --porcelain)" ]]; then
    echo "deploy-server: check out an up-to-date main without local changes (or FORCE=1)" >&2
    exit 1
  fi
fi

# A new private folder on the server: a fixed path in /tmp could be prepared by another account
# there, to swap the files sudo installs.
remote=''
is_remote_valid() { [[ "$remote" =~ ^/[[:alnum:]/._-]+$ ]]; }
# Both folders are removed however the deployment ends (a failed copy, install or update included);
# the server's only once it's a path mktemp could have given.
cleanup() {
  rm -rf "$work"
  if is_remote_valid; then
    # shellcheck disable=SC2029 # $remote is expanded here on purpose.
    ssh "$SYNC_SERVER_SSH" "rm -rf $remote" || true
  fi
}
work="$(mktemp -d)"
trap cleanup EXIT
# The web app the server serves (docs/sync.md › Web app), built from this checkout.
npm run --silent web:export -- --output-dir "$work/web" > /dev/null
scripts/pack-server-files.sh "$work/server-files.tar.gz" "$work/web"

remote="$(ssh "$SYNC_SERVER_SSH" mktemp -d)"
if ! is_remote_valid; then
  echo "deploy-server: unexpected folder from mktemp on the server: $remote" >&2
  exit 1
fi
scp -q "$work/server-files.tar.gz" server/deploy/update-server.sh \
  server/deploy/dishes-cook-server-update.service server/deploy/dishes-cook-server-update.timer \
  "$SYNC_SERVER_SSH:$remote/"
# shellcheck disable=SC2029 # $remote is expanded here on purpose.
ssh "$SYNC_SERVER_SSH" "set -e
  sudo install -m 755 $remote/update-server.sh /usr/local/sbin/dishes-cook-update-server
  sudo install -m 644 $remote/dishes-cook-server-update.service $remote/dishes-cook-server-update.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now --quiet dishes-cook-server-update.timer
  sudo /usr/local/sbin/dishes-cook-update-server --archive $remote/server-files.tar.gz"
