import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { firstMigrations, MIGRATIONS } from '@/test/migrations';

describe('0013_unique-recipe-titles', () => {
  it('numbers the recipes sharing a title, by sync id, with a newer version to push', () => {
    const sqlite = new Database(':memory:');
    const database = drizzle(sqlite);
    migrate(database, { migrationsFolder: firstMigrations(13) });
    const insert = sqlite.prepare(
      'insert into recipes (title, sort_key, sync_id, kind, server_version, updated_at) values (?, ?, ?, ?, 1, 1)',
    );
    insert.run('crêpes', 'crepes', 'syncid000000003', 'dish');
    insert.run('crepes', 'crepes', 'syncid000000001', 'dish');
    // Dishes and drinks share titles.
    insert.run('crêpes', 'crepes', 'syncid000000002', 'drink');
    insert.run('pumpkin soup', 'pumpkin soup', 'syncid000000004', 'dish');

    migrate(database, { migrationsFolder: MIGRATIONS });

    const recipeList = sqlite
      .prepare(
        'select title, sort_key, sync_id, updated_at > 1 as is_changed from recipes order by sync_id',
      )
      .all() as object[];

    // better-sqlite3's rows have no prototype: compared as plain objects.
    expect(recipeList.map((row) => ({ ...row }))).toStrictEqual([
      { is_changed: 0, sort_key: 'crepes', sync_id: 'syncid000000001', title: 'crepes' },
      { is_changed: 1, sort_key: 'crepes (2)', sync_id: 'syncid000000002', title: 'crêpes (2)' },
      { is_changed: 1, sort_key: 'crepes (3)', sync_id: 'syncid000000003', title: 'crêpes (3)' },
      {
        is_changed: 0,
        sort_key: 'pumpkin soup',
        sync_id: 'syncid000000004',
        title: 'pumpkin soup',
      },
    ]);
  });

  it('gives its sync id to a recipe whose number another recipe already had', () => {
    const sqlite = new Database(':memory:');
    const database = drizzle(sqlite);
    migrate(database, { migrationsFolder: firstMigrations(13) });
    const insert = sqlite.prepare(
      'insert into recipes (title, sort_key, sync_id, updated_at) values (?, ?, ?, 1)',
    );
    insert.run('crêpes', 'crepes', 'syncid000000001');
    insert.run('crêpes', 'crepes', 'syncid000000002');
    insert.run('crêpes (2)', 'crepes (2)', 'syncid000000003');

    migrate(database, { migrationsFolder: MIGRATIONS });

    const titleList = sqlite.prepare('select title from recipes order by sync_id').pluck().all();

    expect(titleList).toStrictEqual(['crêpes', 'crêpes (2)', 'crêpes (2) (syncid000000003)']);
  });
});
