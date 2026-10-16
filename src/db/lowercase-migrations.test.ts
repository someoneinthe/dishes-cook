import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const MIGRATIONS = path.join(__dirname, 'migrations');

// A migrations folder with only the first `count` migrations (before names and titles were saved
// in lowercase).
function firstMigrations(count: number): string {
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

describe('lowercase migrations', () => {
  describe('0002_ingredient-names-lowercase', () => {
    it('saves the existing names in lowercase and marks them changed for the sync', () => {
      const sqlite = new Database(':memory:');
      const database = drizzle(sqlite);
      migrate(database, { migrationsFolder: firstMigrations(2) });
      sqlite
        .prepare(
          'insert into ingredients (name, name_key, sort_key, sync_id, updated_at) values (?, ?, ?, ?, 1), (?, ?, ?, ?, 1)',
        )
        .run(
          'Œuf',
          'œuf',
          'oeuf',
          'syncid000000001',
          'farine',
          'farine',
          'farine',
          'syncid000000002',
        );

      migrate(database, { migrationsFolder: MIGRATIONS });

      const rowList = sqlite
        .prepare('select name, updated_at > 1 as changed from ingredients order by name')
        .all() as object[];

      // better-sqlite3's rows have no prototype: compared as plain objects.
      expect(rowList.map((row) => ({ ...row }))).toStrictEqual([
        { changed: 0, name: 'farine' },
        { changed: 1, name: 'œuf' },
      ]);
    });
  });

  describe('0003_recipe-titles-lowercase', () => {
    it('saves the existing titles in lowercase, accents included, and marks them changed', () => {
      const sqlite = new Database(':memory:');
      const database = drizzle(sqlite);
      migrate(database, { migrationsFolder: firstMigrations(3) });
      const insert = sqlite.prepare(
        "insert into recipes (title, sort_key, instructions, season, sync_id, updated_at) values (?, ?, '', 'both', ?, 1)",
      );
      insert.run('ÉCLAIR AU Café', 'eclair au cafe', 'syncid000000001');
      insert.run('Bœuf Bourguignon', 'boeuf bourguignon', 'syncid000000002');
      insert.run('tarte', 'tarte', 'syncid000000003');

      migrate(database, { migrationsFolder: MIGRATIONS });
      const rowList = sqlite
        .prepare('select title, updated_at > 1 as changed from recipes order by sort_key')
        .all() as object[];

      expect(rowList.map((row) => ({ ...row }))).toStrictEqual([
        { changed: 1, title: 'bœuf bourguignon' },
        { changed: 1, title: 'éclair au café' },
        { changed: 0, title: 'tarte' },
      ]);
    });
  });
});
