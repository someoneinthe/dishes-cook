import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { parseSyncedContent } from '@/features/sync/recipe-merge';
import { firstMigrations, MIGRATIONS } from '@/test/migrations';

describe('0012_recipe-synced-content', () => {
  it('keeps the content of the recipes the server has in their version, not of the others', () => {
    const sqlite = new Database(':memory:');
    const database = drizzle(sqlite);
    migrate(database, { migrationsFolder: firstMigrations(12) });
    sqlite
      .prepare(
        "insert into ingredients (id, name, name_key, sort_key, sync_id) values (1, 'leek', 'leek', 'leek', 'leek00000000001'), (2, 'salt', 'salt', 'salt', 'salt00000000001')",
      )
      .run();
    const insert = sqlite.prepare(
      "insert into recipes (id, title, sort_key, instructions, season, course, cook_minutes, sync_id, server_version, updated_at) values (?, ?, ?, 'Cook.', 'winter', 'main', 45, ?, ?, 10)",
    );
    insert.run(1, 'soup', 'soup', 'soup00000000001', 10);
    insert.run(2, 'stew', 'stew', 'stew00000000001', 5);
    insert.run(3, 'pie', 'pie', 'pie000000000001', null);
    sqlite
      .prepare(
        "insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit) values (1, 1, 2, null), (1, 2, 1, 'pinch')",
      )
      .run();

    migrate(database, { migrationsFolder: MIGRATIONS });
    const rowList = sqlite
      .prepare('select id, synced_content from recipes order by id')
      .all() as Readonly<{ id: number; synced_content: null | string }>[];
    const [soup, ...otherList] = rowList.map((row) => row.synced_content);

    expect(parseSyncedContent(soup as null | string)).toStrictEqual({
      cookMinutes: 45,
      course: 'main',
      ingredients: {
        leek00000000001: { amount: 2 },
        salt00000000001: { amount: 1, unit: 'pinch' },
      },
      instructions: 'Cook.',
      kind: 'dish',
      maturationMonths: null,
      prepMinutes: null,
      season: 'winter',
      title: 'soup',
    });
    // Changed here since the server had it, or never on it: not known.
    expect(otherList).toStrictEqual([null, null]);
  });
});
