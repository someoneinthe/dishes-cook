import type { DatabaseChangeListener, DatabaseChangeSource } from './types';

const WRITE_STATEMENT = /^\s*(?:insert|update|delete)\b/i;

// Tells live queries that the data changed, from the app's own writes.
//
// Every write goes through Drizzle, whose logger sees each statement just before it runs. Native
// change events (sqlite3_update_hook via expo-sqlite) aren't used: they stop arriving when a dev
// reload leaves the native listener flag off, and they miss nothing we'd need since no other code
// writes to the database. Listeners aren't told which table changed: a delete cascades to other
// tables, so every live query re-runs (they're sub-millisecond). A sync's writes are held while it
// runs and told once at its end, marked as the sync's (the auto-sync doesn't answer them).
export function createChangeNotifier() {
  const listenerSet = new Set<DatabaseChangeListener>();
  let isPending = false;
  // Writes of a sync: held (not notified) while running, then notified once.
  let isHolding = false;
  let hasHeld = false;

  const notifyAll = (source: DatabaseChangeSource) => {
    for (const listener of listenerSet) {
      // One failing listener must not keep the others (other screens) from refreshing.
      try {
        listener(source);
      } catch (error) {
        console.error('A database change listener failed', error);
      }
    }
  };
  const notify = () => {
    isPending = false;
    notifyAll('app');
  };

  return {
    holdSyncChanges: (write: () => void) => {
      isHolding = true;
      try {
        write();
      } finally {
        isHolding = false;
      }
    },
    // Drizzle `logger` option.
    logger: {
      logQuery: (query: string) => {
        if (!WRITE_STATEMENT.test(query)) {
          return;
        }
        if (isHolding) {
          hasHeld = true;
          return;
        }
        if (isPending) {
          return;
        }
        isPending = true;
        // Queries are synchronous: the microtask runs once the write (or the whole transaction)
        // is done, so a batch of writes notifies once.
        queueMicrotask(notify);
      },
    },
    releaseSyncChanges: () => {
      if (!hasHeld) {
        return;
      }

      hasHeld = false;
      notifyAll('sync');
    },
    subscribe: (listener: DatabaseChangeListener) => {
      listenerSet.add(listener);
      return () => {
        listenerSet.delete(listener);
      };
    },
  };
}
