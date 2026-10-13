import { sql } from 'drizzle-orm';
import {
  findOrCreateIngredient,
  listIngredients,
} from '@/features/ingredients/db/ingredient-queries';
import {
  findRecipeIds,
  getRecipe,
  listRecipes,
  saveRecipe,
} from '@/features/recipes/db/recipe-queries';
import { createTestConnection } from '@/test/test-database';
import type { AppDatabase } from './types';

// Guards the indexes the queries rely on (see docs/database.md): asks SQLite how it runs each
// query and fails if a table is scanned where an index lookup is expected.
describe('query plans', () => {
  let database: AppDatabase;
  let queryList: string[];

  beforeEach(() => {
    queryList = [];
    ({ db: database } = createTestConnection({
      logQuery: (query) => {
        queryList.push(query);
      },
    }));
    const carrotId = findOrCreateIngredient(database, 'carrot').id;
    const leekId = findOrCreateIngredient(database, 'leek').id;
    saveRecipe(database, {
      ingredientIdList: [carrotId, leekId],
      instructions: '',
      season: 'both',
      title: 'Soup',
    });
    queryList = [];
  });

  // Plan of the last query run, one line per step. Parameters are replaced by literals: the plan
  // doesn't depend on their values.
  const lastQueryPlan = () => {
    const query = queryList.at(-1) ?? '';
    return database
      .all<{ detail: string }>(sql.raw(`EXPLAIN QUERY PLAN ${query.replaceAll('?', '1')}`))
      .map((row) => row.detail);
  };

  it('counts ingredient usages with the ingredient index', () => {
    listIngredients(database);

    expect(lastQueryPlan()).toStrictEqual([
      'SCAN ingredients',
      expect.stringMatching(
        /^SEARCH recipe_ingredients USING COVERING INDEX recipe_ingredients_ingredient_recipe_idx/,
      ),
    ]);
  });

  it('counts recipe ingredients with the primary key', () => {
    listRecipes(database);

    expect(lastQueryPlan()).toStrictEqual([
      'SCAN recipes',
      expect.stringMatching(/^SEARCH recipe_ingredients USING COVERING INDEX sqlite_autoindex/),
    ]);
  });

  it('reads a recipe ingredients by primary key', () => {
    getRecipe(database, 1);

    expect(lastQueryPlan()).toStrictEqual([
      expect.stringMatching(/^SEARCH recipe_ingredients USING COVERING INDEX sqlite_autoindex/),
      expect.stringMatching(/^SEARCH ingredients USING INTEGER PRIMARY KEY/),
    ]);
  });

  it('filters recipes by ingredient from the ingredient index', () => {
    findRecipeIds(database, { ingredientIdList: [1, 2], season: 'winter' });

    const planList = lastQueryPlan();

    expect(planList).toContainEqual(
      expect.stringMatching(
        /^SEARCH recipe_ingredients USING COVERING INDEX recipe_ingredients_ingredient_recipe_idx/,
      ),
    );
    expect(planList).toContainEqual(
      expect.stringMatching(/^SEARCH recipes USING INTEGER PRIMARY KEY/),
    );
    expect(planList).not.toContainEqual(expect.stringMatching(/^SCAN/));
  });
});
