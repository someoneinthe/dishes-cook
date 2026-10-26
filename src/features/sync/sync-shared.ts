import { and, eq, sql } from 'drizzle-orm';
import type { cookedMeals, ingredients, recipes, SyncedTable } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { syncDeletions } from '@/db/schema';
import { isSyncId } from '@/lib/sync-id';
import type { ServerRow } from './sync-api';

// What the pull and the push of the sync share: checks of the server's rows, server times, the
// rows to push, and waiting for a page of requests.

export type SyncedTableSchema = typeof cookedMeals | typeof ingredients | typeof recipes;

// The earlier of two server times, '' standing for none.
export function earliest(time: string, other: string): string {
  return time === '' || (other !== '' && other.localeCompare(time) < 0) ? other : time;
}

export function forgetDeletion(tx: AppDatabase, tableName: SyncedTable, syncId: string) {
  tx.delete(syncDeletions)
    .where(and(eq(syncDeletions.tableName, tableName), eq(syncDeletions.syncId, syncId)))
    .run();
}

// An item of a pulled page is an object; its fields are checked when it's applied.
export function isServerRow(item: unknown): item is ServerRow {
  return typeof item === 'object' && item !== null && !Array.isArray(item);
}

// Rows from the server are checked before use: a bad one is skipped, not a failed sync.
export function isValidRow(row: ServerRow): boolean {
  return (
    isSyncId(row.id) &&
    Number.isSafeInteger(row.modified) &&
    row.modified >= 0 &&
    Number.isSafeInteger(row.deleted)
  );
}

// The later of two server times: "2026-10-14 18:03:59.794Z" strings of the same length sort in
// time order, digit by digit.
export function latest(time: string, other: unknown): string {
  return typeof other === 'string' && other.localeCompare(time) > 0 ? other : time;
}

// The rows the server doesn't have in this version: in the *_to_push_idx indexes.
export function notOnServer(table: SyncedTableSchema) {
  return sql`${table.serverVersion} is not ${table.updatedAt}`;
}

// Waits for every request of a page, then fails with the first error if any: no request is left
// running once the sync has ended (the next one could overlap it).
export async function settleAll(promiseList: readonly Promise<unknown>[]): Promise<void> {
  throwFirstFailure(await Promise.allSettled(promiseList));
}

export function throwFirstFailure(resultList: readonly PromiseSettledResult<unknown>[]): void {
  for (const result of resultList) {
    if (result.status === 'rejected') {
      throw result.reason;
    }
  }
}
