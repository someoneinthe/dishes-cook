import type { DatabaseChangeListener } from './types';

const WRITE_STATEMENT = /^\s*(?:insert|update|delete)\b/i;

// Tells live queries that the data changed, from the app's own writes.
//
// Every write goes through Drizzle, whose logger sees each statement just before it runs. Native
// change events (sqlite3_update_hook via expo-sqlite) aren't used: they stop arriving when a dev
// reload leaves the native listener flag off, and they miss nothing we'd need since no other code
// writes to the database. Listeners aren't told which table changed: a delete cascades to other
// tables, so every live query re-runs (they're sub-millisecond).
export function createChangeNotifier() {
  const listenerSet = new Set<DatabaseChangeListener>();
  let isPending = false;

  const notify = () => {
    isPending = false;
    for (const listener of listenerSet) {
      // One failing listener must not keep the others (other screens) from refreshing.
      try {
        listener();
      } catch (error) {
        console.error('A database change listener failed', error);
      }
    }
  };

  return {
    // Drizzle `logger` option.
    logger: {
      logQuery: (query: string) => {
        if (isPending || !WRITE_STATEMENT.test(query)) {
          return;
        }
        isPending = true;
        // Queries are synchronous: the microtask runs once the write (or the whole transaction)
        // is done, so a batch of writes notifies once.
        queueMicrotask(notify);
      },
    },
    subscribe: (listener: DatabaseChangeListener) => {
      listenerSet.add(listener);
      return () => {
        listenerSet.delete(listener);
      };
    },
  };
}
