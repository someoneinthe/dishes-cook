import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import type { DatabaseConnection } from '@/db/types';
import { createChangeNotifier } from '@/db/change-notifier';
import { DatabaseContext } from '@/db/database-context';

// A fresh in-memory SQLite database with the app's real migrations, for query and screen tests.
// better-sqlite3 runs the same SQLite engine (and SQL) as expo-sqlite on the device, and live
// queries are notified by the same change notifier as in the app.
// `logQuery` receives the SQL of every query (used to check query plans).
export function createTestConnection(
  options: Readonly<{ logQuery?: (query: string) => void }> = {},
): DatabaseConnection {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  const notifier = createChangeNotifier();
  const { logQuery } = options;
  const database = drizzle(sqlite, {
    logger: {
      logQuery: (query) => {
        notifier.logger.logQuery(query);
        logQuery?.(query);
      },
    },
  });
  migrate(database, { migrationsFolder: path.join(__dirname, '../db/migrations') });

  return { db: database, subscribe: notifier.subscribe };
}

export function renderWithDatabase(ui: ReactElement, connection: DatabaseConnection) {
  return render(<DatabaseContext value={connection}>{ui}</DatabaseContext>);
}
