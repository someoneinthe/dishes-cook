import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { firstMigrations, MIGRATIONS } from '@/test/migrations';

describe('0004_meal-history', () => {
  it('keeps the deletions waiting for the sync server, and accepts those of meals', () => {
    const sqlite = new Database(':memory:');
    const database = drizzle(sqlite);
    migrate(database, { migrationsFolder: firstMigrations(4) });
    sqlite
      .prepare(
        "insert into sync_deletions (table_name, sync_id, deleted_at) values ('recipes', 'syncid000000001', 5), ('ingredients', 'syncid000000002', 6)",
      )
      .run();
    sqlite
      .prepare(
        "insert into recipes (title, sort_key, sync_id) values ('soup', 'soup', 'syncid000000003')",
      )
      .run();

    // sync_deletions is rebuilt (its CHECK changes): its rows are copied, and nothing else is
    // touched (no foreign key points to it).
    migrate(database, { migrationsFolder: MIGRATIONS });
    sqlite
      .prepare(
        "insert into sync_deletions (table_name, sync_id) values ('cooked_meals', 'syncid000000004')",
      )
      .run();

    const rowList = sqlite
      .prepare('select table_name, sync_id from sync_deletions order by sync_id')
      .all() as object[];

    // better-sqlite3's rows have no prototype: compared as plain objects.
    expect(rowList.map((row) => ({ ...row }))).toStrictEqual([
      { sync_id: 'syncid000000001', table_name: 'recipes' },
      { sync_id: 'syncid000000002', table_name: 'ingredients' },
      { sync_id: 'syncid000000004', table_name: 'cooked_meals' },
    ]);
    expect({
      ...(sqlite.prepare('select count(*) as count from recipes').get() as object),
    }).toStrictEqual({
      count: 1,
    });
  });
});
