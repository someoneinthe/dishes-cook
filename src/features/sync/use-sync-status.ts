import { useQuery } from '@tanstack/react-query';
import { useDatabase } from '@/db/database-context';
import type { SyncErrorKind } from './sync-api';
import { getPendingChangeCount, useSyncState } from './sync-store';

export type SyncStatus = Readonly<
  // The last sync failed (it's retried by itself): changes wait on the phone meanwhile.
  | { error: SyncErrorKind; kind: 'failed'; pendingCount: number }
  // Changes not pushed yet: the next sync sends them (a few seconds after an edit).
  | { kind: 'waiting'; pendingCount: number }
>;

// What the header tells about the sync: undefined while all is synced, or without a server.
export function useSyncStatus(): SyncStatus | undefined {
  const database = useDatabase();
  const { connection, error, lastSyncedAt } = useSyncState();
  const isConnected = connection !== undefined;
  const countPending = () => (isConnected ? getPendingChangeCount(database) : 0);
  // Writes refresh it (every query is invalidated after a write), and so does each finished sync:
  // it moves the push cursor, even when nothing was written.
  const { data: pendingCount } = useQuery({
    initialData: countPending,
    queryFn: countPending,
    queryKey: ['sync', 'pending-count', { isConnected, lastSyncedAt }],
  });

  if (error !== undefined) {
    return { error, kind: 'failed', pendingCount };
  }
  return pendingCount > 0 ? { kind: 'waiting', pendingCount } : undefined;
}
