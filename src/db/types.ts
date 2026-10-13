import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

// The app runs on expo-sqlite and the tests on better-sqlite3: both are synchronous Drizzle
// drivers, so queries are written once against this common type.
export type AppDatabase = BaseSQLiteDatabase<'sync', unknown>;

// Called with the name of a table a write touched.
export type DatabaseChangeListener = (tableName: string) => void;

export type DatabaseConnection = Readonly<{
  db: AppDatabase;
  // Subscribes to writes; returns the unsubscribe function.
  subscribe: (listener: DatabaseChangeListener) => () => void;
}>;
