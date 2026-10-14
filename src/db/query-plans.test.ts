import { sql } from 'drizzle-orm';
import {
  findOrCreateIngredient,
  listIngredientPage,
  suggestIngredients,
} from '@/features/ingredients/db/ingredient-queries';
import {
  countRecipes,
  getRecipe,
  listRecipePage,
  pickRandomRecipeId,
  saveRecipe,
} from '@/features/recipes/db/recipe-queries';
import { createTestConnection } from '@/test/test-database';
import type { AppDatabase } from './types';

const CURSOR = { id: 1, sortKey: 'm' };

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

  const planOf = (query = '') =>
    database
      .all<{ detail: string }>(sql.raw(`EXPLAIN QUERY PLAN ${query.replaceAll('?', '1')}`))
      .map((row) => row.detail);

  // The EXPLAIN queries are logged too: skip them.
  const lastQuery = () => queryList.findLast((query) => !query.startsWith('EXPLAIN'));
  const lastPlan = () => planOf(lastQuery());
  const INGREDIENT_INDEX =
    /^SEARCH recipe_ingredients USING COVERING INDEX recipe_ingredients_ingredient_recipe_idx/;

  it.each([
    ['the first page', null],
    ['a page after a cursor', { after: CURSOR }],
    ['a page before a cursor', { before: CURSOR }],
  ])('reads %s of ingredients in index order, without sorting', (_, pageRequest) => {
    listIngredientPage(database, { pageParam: pageRequest, search: 'ca' });
    const planList = lastPlan();

    expect(planList[0]).toMatch(
      /^(SCAN|SEARCH) ingredients USING INDEX ingredients_sort_key_id_idx/,
    );
    expect(planList.join('\n')).not.toContain('TEMP B-TREE');
  });

  it('counts ingredient usages with the ingredient index', () => {
    listIngredientPage(database, { pageParam: null, search: '' });

    expect(lastPlan()).toContainEqual(expect.stringMatching(INGREDIENT_INDEX));
  });

  it('reads recipe pages in index order and counts ingredients with the primary key', () => {
    listRecipePage(database, { pageParam: { after: CURSOR }, search: 'so' });
    const planList = lastPlan();

    expect(planList[0]).toMatch(/^SEARCH recipes USING INDEX recipes_sort_key_id_idx/);
    expect(planList).toContainEqual(
      expect.stringMatching(/^SEARCH recipe_ingredients USING COVERING INDEX sqlite_autoindex/),
    );
    expect(planList.join('\n')).not.toContain('TEMP B-TREE');
  });

  it('reads a recipe ingredients by primary key', () => {
    getRecipe(database, 1);

    expect(lastPlan()).toStrictEqual([
      expect.stringMatching(/^SEARCH recipe_ingredients USING COVERING INDEX sqlite_autoindex/),
      expect.stringMatching(/^SEARCH ingredients USING INTEGER PRIMARY KEY/),
      // Sorting one recipe's few ingredients by name: a small, bounded sort.
      'USE TEMP B-TREE FOR ORDER BY',
    ]);
  });

  it.each([
    ['counts', () => countRecipes(database, { ingredientIdList: [1, 2], season: 'winter' })],
    [
      'picks',
      () => pickRandomRecipeId(database, { ingredientIdList: [1], season: 'winter' }, 1, () => 0),
    ],
  ])('%s recipes filtered by ingredient from the ingredient index', (_, run) => {
    run();
    const planList = lastPlan();

    expect(planList).toContainEqual(expect.stringMatching(INGREDIENT_INDEX));
    expect(planList).toContainEqual(
      expect.stringMatching(/^SEARCH recipes USING INTEGER PRIMARY KEY/),
    );
    expect(planList).not.toContainEqual(expect.stringMatching(/^SCAN/));
  });

  it('ranks suggestions with the usage index (a bounded scan: every match is ranked)', () => {
    suggestIngredients(database, { excludeIdList: [1], isUsedOnly: true, limit: 12, search: 'ca' });

    expect(lastPlan()).toContainEqual(expect.stringMatching(INGREDIENT_INDEX));
    expect(lastQuery()).toMatch(/limit \?$/);
  });
});
