import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The app's migrations folder, all of them.
export const MIGRATIONS = path.join(__dirname, '..', 'db', 'migrations');

// A migrations folder with only the first `count` migrations: a database as an older app version
// left it, to check that a newer migration keeps its rows.
export function firstMigrations(count: number): string {
  const folder = mkdtempSync(path.join(tmpdir(), 'migrations-'));
  mkdirSync(path.join(folder, 'meta'));
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS, 'meta/_journal.json'), 'utf8')) as {
    entries: { tag: string }[];
  };
  const entryList = journal.entries.slice(0, count);
  writeFileSync(
    path.join(folder, 'meta/_journal.json'),
    JSON.stringify({ ...journal, entries: entryList }),
  );
  for (const { tag } of entryList) {
    copyFileSync(path.join(MIGRATIONS, `${tag}.sql`), path.join(folder, `${tag}.sql`));
  }
  return folder;
}
