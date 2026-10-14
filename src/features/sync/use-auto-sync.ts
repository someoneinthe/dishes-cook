import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { DatabaseConnection } from '@/db/types';
import { useDatabaseConnection } from '@/db/database-context';
import { getSyncState, syncNow, useSyncState } from './sync-store';

// Changes made on the phone are pushed a few seconds after the last one, so a burst of edits makes
// one sync.
export const WRITE_SYNC_DELAY_MS = 5000;

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
  // Writes notified during a sync are the sync's own (pulled rows) or the user's: a sync follows
  // anyway, which pushes the user's and finds nothing new otherwise.
  let isWrittenDuringSync = false;

  const run = async () => {
    await syncNow(db);
    if (!isWrittenDuringSync) {
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
    if (appState === 'active') {
      void run();
    }
  });
  const unsubscribe = connection.subscribe(() => {
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
