import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { firstMigrations, MIGRATIONS } from '@/test/migrations';

describe('0007_sort-keys-ligatures', () => {
  it('writes the ligatures of the sort keys out, leaving the names and updated_at as they were', () => {
    const sqlite = new Database(':memory:');
    const database = drizzle(sqlite);
    migrate(database, { migrationsFolder: firstMigrations(7) });
    sqlite
      .prepare(
        'insert into ingredients (name, name_key, sort_key, sync_id, updated_at) values (?, ?, ?, ?, 1), (?, ?, ?, ?, 1)',
      )
      .run('œuf', 'œuf', 'œuf', 'syncid000000001', 'farine', 'farine', 'farine', 'syncid000000002');
    sqlite
      .prepare(
        "insert into recipes (title, sort_key, instructions, season, sync_id, updated_at) values (?, ?, '', 'both', ?, 1)",
      )
      .run('bœuf en cæcum', 'bœuf en cæcum', 'syncid000000003');

    migrate(database, { migrationsFolder: MIGRATIONS });

    const ingredientList = sqlite
      .prepare('select name, sort_key, updated_at from ingredients order by name')
      .all() as object[];
    const recipeList = sqlite
      .prepare('select title, sort_key, updated_at from recipes')
      .all() as object[];

    // better-sqlite3's rows have no prototype: compared as plain objects.
    expect(ingredientList.map((row) => ({ ...row }))).toStrictEqual([
      { name: 'farine', sort_key: 'farine', updated_at: 1 },
      { name: 'œuf', sort_key: 'oeuf', updated_at: 1 },
    ]);
    expect(recipeList.map((row) => ({ ...row }))).toStrictEqual([
      { sort_key: 'boeuf en caecum', title: 'bœuf en cæcum', updated_at: 1 },
    ]);
  });
});
