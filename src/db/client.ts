import { drizzle } from 'drizzle-orm/expo-sqlite';
import { addDatabaseChangeListener, openDatabaseSync } from 'expo-sqlite';
import type { DatabaseConnection } from './types';

const DATABASE_NAME = 'dishes-cook.db';

export function createAppConnection(
  database: ReturnType<typeof openAppDatabase>,
): DatabaseConnection {
  return {
    db: database,
    subscribe: (listener) => {
      // sqlite3_update_hook reports every modified row: a recipe saved with 10 ingredients emits
      // a dozen events. They are coalesced into one notification per table and per tick.
      const changedTableSet = new Set<string>();
      let flush: ReturnType<typeof setTimeout> | undefined;
      const subscription = addDatabaseChangeListener(({ tableName }) => {
        changedTableSet.add(tableName);
        flush ??= setTimeout(() => {
          flush = undefined;
          const tableNameList = [...changedTableSet];
          changedTableSet.clear();
          for (const changedTableName of tableNameList) {
            listener(changedTableName);
          }
        }, 0);
      });
      return () => {
        subscription.remove();
        clearTimeout(flush);
      };
    },
  };
}

export function openAppDatabase() {
  // The change listener (sqlite3_update_hook) powers the live queries.
  const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
  // WAL: faster writes, readers never blocked. Foreign keys are off by default in SQLite and the
  // setting is per connection, so it's enabled on every open.
  sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return drizzle(sqlite);
}
