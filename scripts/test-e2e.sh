#!/usr/bin/env bash
# Runs the Maestro flows of .maestro/ on the Android emulator or device adb points at (set
# ANDROID_SERIAL when there are several), with an end-to-end build of the app installed (see
# .maestro/README.md), and a throwaway sync server (pocketbase-server.sh) the phone reaches on its
# own localhost (adb reverse). Extra arguments go to `maestro test` (e.g. a single flow file);
# without any, every flow runs.
set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/pocketbase-server.sh
start_pocketbase

# The account the app signs in with: a throwaway one, like the server.
account_email="home@example.org"
account_password="$(node -e 'console.log(require("node:crypto").randomBytes(18).toString("base64url"))')"
superuser_token="$(
  curl --fail --silent --show-error --header 'Content-Type: application/json' \
    --data "{\"identity\":\"$POCKETBASE_SUPERUSER_EMAIL\",\"password\":\"$POCKETBASE_SUPERUSER_PASSWORD\"}" \
    "$POCKETBASE_URL/api/collections/_superusers/auth-with-password" |
    node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(0, "utf8")).token)'
)"
curl --fail --silent --show-error --output /dev/null --header 'Content-Type: application/json' \
  --header "Authorization: $superuser_token" \
  --data "{\"email\":\"$account_email\",\"password\":\"$account_password\",\"passwordConfirm\":\"$account_password\"}" \
  "$POCKETBASE_URL/api/collections/users/records"

adb reverse "tcp:$POCKETBASE_PORT" "tcp:$POCKETBASE_PORT" > /dev/null
trap 'adb reverse --remove "tcp:$POCKETBASE_PORT" > /dev/null 2>&1 || true; stop_pocketbase' EXIT

if [[ $# -eq 0 ]]; then
  set -- .maestro
fi
# Maestro picks a device on its own: give it the one adb uses.
device_option=()
if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  device_option=(--device "$ANDROID_SERIAL")
fi
export MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
maestro "${device_option[@]}" test \
  --env SERVER_URL="http://localhost:$POCKETBASE_PORT" \
  --env EMAIL="$account_email" \
  --env PASSWORD="$account_password" \
  "$@" || {
  status=$?
  pocketbase_log
  exit "$status"
}
