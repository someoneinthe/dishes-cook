import type { ReactElement, ReactNode } from 'react';
import { notifyManager } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import type { DatabaseConnection } from '@/db/types';
import { createChangeNotifier } from '@/db/change-notifier';
import { createQueryClient, DataProvider } from '@/db/data-provider';

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

// TanStack Query notifies components on a timer by default: as microtasks, its updates settle inside
// RNTL's async act() instead of after the test.
notifyManager.setScheduler(queueMicrotask);

// Wraps components or hooks under test in the app's data providers (database + TanStack Query).
export function createDataWrapper(connection: DatabaseConnection) {
  const queryClient = createQueryClient();
  // No garbage collection timers left running after a test.
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, gcTime: Infinity },
  });
  return function DataWrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <DataProvider connection={connection} queryClient={queryClient}>
        {children}
      </DataProvider>
    );
  };
}

export function renderWithDatabase(ui: ReactElement, connection: DatabaseConnection) {
  return render(ui, { wrapper: createDataWrapper(connection) });
}
