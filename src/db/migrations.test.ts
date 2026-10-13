import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Runs one migration file on a database, the way Drizzle splits it into statements.
function runMigration(sqlite: Database.Database, fileName: string) {
  const migration = readFileSync(path.join(__dirname, 'migrations', fileName), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint')) {
    sqlite.exec(statement);
  }
}

describe('migration 0002 (recipe course)', () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    runMigration(sqlite, '0000_init.sql');
    runMigration(sqlite, '0001_sort_keys.sql');
    sqlite.exec(`
      INSERT INTO ingredients (id, name, name_key) VALUES (1, 'Leek', 'leek');
      INSERT INTO recipes (id, title) VALUES (1, 'Soup');
      INSERT INTO recipe_ingredients (recipe_id, ingredient_id) VALUES (1, 1);
    `);
  });

  it('keeps existing recipes and their ingredients, without a course', () => {
    sqlite.transaction(() => runMigration(sqlite, '0002_course.sql'))();

    // better-sqlite3 rows have no prototype: spread into plain objects to compare them.
    const rowList = sqlite.prepare('SELECT title, course FROM recipes').all();

    expect(rowList.map((row) => ({ ...(row as object) }))).toStrictEqual([
      { course: null, title: 'Soup' },
    ]);
    expect(sqlite.prepare('SELECT count(*) AS count FROM recipe_ingredients').get()).toMatchObject({
      count: 1,
    });
  });

  it('only accepts starter, main or dessert', () => {
    runMigration(sqlite, '0002_course.sql');
    const courseUpdate = sqlite.prepare('UPDATE recipes SET course = ? WHERE id = 1');

    expect(() => courseUpdate.run('dessert')).not.toThrow();
    expect(() => courseUpdate.run('snack')).toThrow(/CHECK constraint failed/);
  });
});
