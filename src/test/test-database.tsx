import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import Database from 'better-sqlite3';
import { getTableName } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import type { DatabaseChangeListener, DatabaseConnection } from '@/db/types';
import { DatabaseContext } from '@/db/database-context';
import { ingredients, recipeIngredients, recipes } from '@/db/schema';

const WRITE_STATEMENT = /^\s*(?:insert|update|delete)\b/i;
const TABLE_NAME_LIST = [ingredients, recipeIngredients, recipes].map((table) =>
  getTableName(table),
);

// A fresh in-memory SQLite database with the app's real migrations, for query and screen tests.
// better-sqlite3 runs the same SQLite engine (and SQL) as expo-sqlite on the device.
// `logQuery` receives the SQL of every query (used to check query plans).
export function createTestConnection(
  options: Readonly<{ logQuery?: (query: string) => void }> = {},
): DatabaseConnection {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  // expo-sqlite reports writes through sqlite3_update_hook, which better-sqlite3 doesn't expose:
  // writes are detected from the SQL instead, and reported for every table (good enough for tests).
  const listenerSet = new Set<DatabaseChangeListener>();
  const prepare = sqlite.prepare.bind(sqlite);
  sqlite.prepare = ((source: string) => {
    const statement = prepare(source);
    if (WRITE_STATEMENT.test(source)) {
      for (const method of ['run', 'get', 'all'] as const) {
        const original = statement[method].bind(statement);
        Object.assign(statement, {
          [method]: (...arguments_: unknown[]) => {
            const result: unknown = Reflect.apply(original, undefined, arguments_);
            for (const tableName of TABLE_NAME_LIST) {
              for (const listener of listenerSet) {
                listener(tableName);
              }
            }
            return result;
          },
        });
      }
    }
    return statement;
  }) as typeof sqlite.prepare;

  const { logQuery } = options;
  const database = drizzle(sqlite, logQuery ? { logger: { logQuery } } : {});
  migrate(database, { migrationsFolder: path.join(__dirname, '../db/migrations') });

  return {
    db: database,
    subscribe: (listener) => {
      listenerSet.add(listener);
      return () => listenerSet.delete(listener);
    },
  };
}

export function renderWithDatabase(ui: ReactElement, connection: DatabaseConnection) {
  return render(<DatabaseContext value={connection}>{ui}</DatabaseContext>);
}
