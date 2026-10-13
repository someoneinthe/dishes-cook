import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import type { DatabaseConnection } from './types';
import { createChangeNotifier } from './change-notifier';

const DATABASE_NAME = 'dishes-cook.db';

export function openAppConnection() {
  const sqlite = openDatabaseSync(DATABASE_NAME);
  // Foreign keys are off by default in SQLite and the setting is per connection: enabled on every
  // open, on its own, because a multi-statement exec stops at the first failing statement.
  sqlite.execSync('PRAGMA foreign_keys = ON;');
  // WAL: faster writes, readers never blocked. Only a speed-up: keep the default journal if the
  // switch fails (e.g. SQLITE_BUSY).
  try {
    sqlite.execSync('PRAGMA journal_mode = WAL;');
  } catch (error) {
    console.warn('Could not enable WAL, keeping the default journal mode', error);
  }
  const { logger, subscribe } = createChangeNotifier();
  return { db: drizzle(sqlite, { logger }), subscribe } satisfies DatabaseConnection;
}
