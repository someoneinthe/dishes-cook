import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

// The app runs on expo-sqlite and the tests on better-sqlite3: both are synchronous Drizzle
// drivers, so queries are written once against this common type.
export type AppDatabase = BaseSQLiteDatabase<'sync', unknown>;

// Called after the data changed: by the app's own writes ('app', e.g. the user's), or by a sync
// ('sync': once at its end, for all it wrote).
export type DatabaseChangeListener = (source: DatabaseChangeSource) => void;

export type DatabaseChangeSource = 'app' | 'sync';

export type DatabaseConnection = Readonly<{
  db: AppDatabase;
  // Runs writes of a sync (synchronous) without telling the listeners yet: a sync writes page
  // after page, and screens would refresh after each.
  holdSyncChanges: (write: () => void) => void;
  // Tells the listeners, once, that the held writes happened ('sync'), if there were any.
  releaseSyncChanges: () => void;
  // Subscribes to writes; returns the unsubscribe function.
  subscribe: (listener: DatabaseChangeListener) => () => void;
}>;
