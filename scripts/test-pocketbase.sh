#!/usr/bin/env bash
# Runs the sync scenarios (src/features/sync/sync-engine.pocketbase.test.ts) against a real,
# throwaway PocketBase (see pocketbase-server.sh). Extra arguments go to Jest.
set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/pocketbase-server.sh
start_pocketbase

npx jest --ci src/features/sync/sync-engine.pocketbase.test.ts "$@" || {
  status=$?
  pocketbase_log
  exit "$status"
}
