#!/usr/bin/env bash
# Runs the Maestro flows of .maestro/ on the Android emulator or device adb points at (set
# ANDROID_SERIAL when there are several), with an end-to-end build of the app installed (see
# .maestro/README.md), and a throwaway sync server (pocketbase-server.sh) the phone reaches on its
# own localhost (adb reverse). Extra arguments go to `maestro test` (e.g. a single flow file);
# without any, every flow runs.
#
# Options, before the others:
#   --output-dir DIR  keeps each run's JUnit report, screenshots and logs (and the emulator's log
#                     when it fails) in DIR/attempt-1 (DIR/attempt-2 for a retry).
#   --retry           runs the flows that failed once more, each run on a new throwaway server: the
#                     tests fail only when a flow fails twice. For CI, whose emulator crashes now and
#                     then (see .maestro/README.md); without it, the first failure fails the tests.
#                     The other arguments are then flow files or folders only.
set -euo pipefail

cd "$(dirname "$0")/.."

output_dir=""
retry=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir)
      output_dir="$2"
      shift 2
      ;;
    --retry)
      retry=true
      shift
      ;;
    *) break ;;
  esac
done
if [[ $# -eq 0 ]]; then
  set -- .maestro
fi
if [[ "$retry" == true ]]; then
  for argument in "$@"; do
    if [[ "$argument" == -* ]]; then
      echo "--retry runs flow files or folders only, not Maestro's options ($argument)." >&2
      exit 2
    fi
  done
  # The retry needs the first run's report to know which flows failed.
  if [[ -z "$output_dir" ]]; then
    output_dir="$(mktemp -d)"
  fi
fi

source scripts/pocketbase-server.sh

# A new throwaway server, and the throwaway account the app signs in with.
account_email="home@example.org"
account_password=""
start_server() {
  start_pocketbase
  account_password="$(node -e 'console.log(require("node:crypto").randomBytes(18).toString("base64url"))')"
  local superuser_token
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
}
stop_server() {
  if [[ -n "${POCKETBASE_PORT:-}" ]]; then
    adb reverse --remove "tcp:$POCKETBASE_PORT" > /dev/null 2>&1 || true
  fi
  stop_pocketbase
}
trap stop_server EXIT

# Maestro picks a device on its own: give it the one adb uses.
device_option=()
if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  device_option=(--device "$ANDROID_SERIAL")
fi
export MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

# Runs the flows (arguments) on a new server; sets attempt_status to Maestro's exit status.
attempt=0
attempt_status=0
run_attempt() {
  attempt=$((attempt + 1))
  local report_option=() attempt_dir=""
  if [[ -n "$output_dir" ]]; then
    attempt_dir="$output_dir/attempt-$attempt"
    mkdir -p "$attempt_dir"
    report_option=(--format junit --output "$attempt_dir/report.xml" --test-output-dir "$attempt_dir")
    adb logcat -c > /dev/null 2>&1 || true
  fi
  start_server
  attempt_status=0
  maestro ${device_option[@]+"${device_option[@]}"} test \
    --env SERVER_URL="http://localhost:$POCKETBASE_PORT" \
    --env EMAIL="$account_email" \
    --env PASSWORD="$account_password" \
    ${report_option[@]+"${report_option[@]}"} \
    "$@" || attempt_status=$?
  if [[ "$attempt_status" -ne 0 ]]; then
    pocketbase_log
    if [[ -n "$attempt_dir" ]]; then
      adb logcat -d > "$attempt_dir/logcat.txt" 2>&1 || true
    fi
  fi
  stop_server
}

run_attempt "$@"
if [[ "$attempt_status" -eq 0 || "$retry" != true ]]; then
  exit "$attempt_status"
fi

# Retry: only the flows that failed (all of them when the report can't tell).
failed_flows=()
while IFS= read -r flow; do
  if [[ -n "$flow" ]]; then
    failed_flows+=("$flow")
  fi
done < <(node scripts/e2e-failed-flows.mjs "$output_dir/attempt-1/report.xml" "$@")
if [[ ${#failed_flows[@]} -eq 0 ]]; then
  failed_flows=("$@")
fi
echo "Failed: ${failed_flows[*]}. Running them once more, on a new server (reports: $output_dir)…"
run_attempt "${failed_flows[@]}"
if [[ "$attempt_status" -ne 0 ]]; then
  echo "Failed twice: not a flaky run." >&2
  exit "$attempt_status"
fi

# Passed on the retry: say so, so flaky runs stay visible (a warning on the workflow run in CI).
for flow in "${failed_flows[@]}"; do
  message="$flow failed, then passed when run again (a crash of the emulator, or a flaky flow?)."
  if [[ "${GITHUB_ACTIONS:-}" == true ]]; then
    echo "::warning title=Flaky end-to-end flow::$message Screenshots and logs of both runs: the run's maestro-output artifact."
  else
    echo "Warning: $message Screenshots and logs of both runs: $output_dir" >&2
  fi
done
