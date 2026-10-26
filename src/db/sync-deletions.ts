import type { SyncedTable } from './schema';
import type { AppDatabase } from './types';
import { NOW_MS, syncDeletions } from './schema';

// Records a synced row deleted here, in the delete's transaction: the next sync tells the server
// (see docs/sync.md › How it works › Deletions). Deleted again later: the later time is kept.
export function recordDeletion(tx: AppDatabase, tableName: SyncedTable, syncId: string): void {
  tx.insert(syncDeletions)
    .values({ syncId, tableName })
    .onConflictDoUpdate({
      set: { deletedAt: NOW_MS },
      target: [syncDeletions.tableName, syncDeletions.syncId],
    })
    .run();
}
