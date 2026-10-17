import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { DatabaseConnection } from '@/db/types';
import { useDatabaseConnection } from '@/db/database-context';
import { getPendingChangeCount, getSyncState, syncNow, useSyncState } from './sync-store';

// Changes made on the phone are pushed a few seconds after the last one, so a burst of edits makes
// one sync.
export const WRITE_SYNC_DELAY_MS = 5000;

// Back in the foreground within this time of a sync that worked, with nothing waiting: no sync.
export const FOREGROUND_SYNC_INTERVAL_MS = 60_000;

// Syncs with the server while connected: when the app starts or comes back to the foreground, and
// after changes. Away from the home network a sync just fails quietly (the settings show it) and
// the next one catches up. Used once, inside the database provider.
export function useAutoSync(): void {
  const connection = useDatabaseConnection();
  const isConnected = useSyncState().connection !== undefined;

  useEffect(() => (isConnected ? startAutoSync(connection) : undefined), [connection, isConnected]);
}

// Starts syncing; returns the function that stops it.
function startAutoSync(connection: DatabaseConnection): () => void {
  const { db } = connection;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The user's writes during a sync: another one follows, which pushes them. The sync's own writes
  // (pulled rows) don't call for one.
  let isWrittenDuringSync = false;

  // Synced a moment ago, without error, and nothing waits to be sent. A sync dated in the future
  // (the clock was set back since) doesn't count: it would skip every foreground sync until then.
  const isUpToDate = () => {
    const { error, lastSyncedAt } = getSyncState();
    const age = lastSyncedAt === undefined ? undefined : Date.now() - lastSyncedAt;
    return (
      error === undefined &&
      age !== undefined &&
      age >= 0 &&
      age < FOREGROUND_SYNC_INTERVAL_MS &&
      getPendingChangeCount(db) === 0
    );
  };
  const run = async () => {
    await syncNow(connection);
    // Also when the sync itself left changes to send (an ingredient deleted elsewhere that a
    // recipe here still uses is sent again), but not after a failure: the next trigger retries.
    const isLeftToSend = getSyncState().error === undefined && getPendingChangeCount(db) > 0;
    if (!isWrittenDuringSync && !isLeftToSend) {
      return;
    }
    isWrittenDuringSync = false;
    schedule();
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), WRITE_SYNC_DELAY_MS);
  };

  void run();
  const appStateSubscription = AppState.addEventListener('change', (appState) => {
    if (appState === 'active' && !isUpToDate()) {
      void run();
    }
  });
  const unsubscribe = connection.subscribe((source) => {
    if (source === 'sync') {
      return;
    }
    if (getSyncState().isSyncing) {
      isWrittenDuringSync = true;
    } else {
      schedule();
    }
  });
  return () => {
    clearTimeout(timer);
    appStateSubscription.remove();
    unsubscribe();
  };
}
