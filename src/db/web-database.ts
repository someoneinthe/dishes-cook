import { openDatabaseAsync } from 'expo-sqlite';
import { DATABASE_NAME } from './client';

// The web: expo-sqlite runs SQLite in a web worker, and its synchronous calls (all the app's) wait
// for the worker by blocking the page. The worker can't start while the page is blocked, so the
// first call would wait forever: it's started asynchronously, by opening the database, before the
// app's first synchronous call (index.ts). The connection opened here is closed: the app opens its
// own.
export async function startWebDatabase(): Promise<void> {
  const database = await openDatabaseAsync(DATABASE_NAME);
  await database.closeAsync();
}
