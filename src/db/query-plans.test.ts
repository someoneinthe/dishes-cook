import { sql } from 'drizzle-orm';
import type { SyncApi } from '@/features/sync/sync-api';
import {
  findOrCreateIngredient,
  findSimilarIngredient,
  listIngredientPage,
  suggestIngredients,
} from '@/features/ingredients/db/ingredient-queries';
import { getLastCookedMeal, markCooked } from '@/features/meal-history/db/cooked-meal-queries';
import {
  countRecipes,
  getRecipe,
  getRecipeCard,
  listRecipePage,
  pickRandomRecipeId,
  saveRecipe,
} from '@/features/recipes/db/recipe-queries';
import { listShoppingLines } from '@/features/shopping-list/db/shopping-queries';
import { INITIAL_CURSORS, synchronize } from '@/features/sync/sync-engine';
import { createTestConnection } from '@/test/test-database';
import type { AppDatabase } from './types';

const CURSOR = { id: 1, sortKey: 'm' };

// A query as it ran, with its parameters: plans are read with them bound, as the app runs them.
// With constants written in, SQLite plans some queries better than the app gets.
type LoggedQuery = Readonly<{ parameterList: unknown[]; query: string }>;

describe('query plans', () => {
  let database: AppDatabase;
  let queryList: LoggedQuery[];
  let carrotId: number;

  beforeEach(() => {
    queryList = [];
    ({ db: database } = createTestConnection({
      logQuery: (query, parameterList) => {
        queryList.push({ parameterList, query });
      },
    }));
    carrotId = findOrCreateIngredient(database, 'carrot').id;
    const leekId = findOrCreateIngredient(database, 'leek').id;
    saveRecipe(database, {
      ingredientIdList: [carrotId, leekId],
      instructions: '',
      kind: 'dish',
      season: 'both',
      title: 'Soup',
    });
    queryList = [];
  });

  const planOf = (logged: LoggedQuery | undefined) => {
    const { parameterList = [], query = '' } = logged ?? {};
    const statement = sql.join(
      query
        .split('?')
        .map((part, index) =>
          index < parameterList.length
            ? sql`${sql.raw(part)}${parameterList[index]}`
            : sql.raw(part),
        ),
    );
    return database
      .all<{ detail: string }>(sql`EXPLAIN QUERY PLAN ${statement}`)
      .map((row) => row.detail);
  };

  // The EXPLAIN queries are logged too: skip them.
  const lastQuery = () => queryList.findLast(({ query }) => !query.startsWith('EXPLAIN'));
  const lastPlan = () => planOf(lastQuery());
  const INGREDIENT_INDEX =
    /^SEARCH recipe_ingredients USING COVERING INDEX recipe_ingredients_ingredient_recipe_idx/;

  it('reads the first page of ingredients in index order, without sorting', () => {
    listIngredientPage(database, { pageParam: null, search: 'ca' });
    const planList = lastPlan();

    expect(planList[0]).toMatch(/^SCAN ingredients USING INDEX ingredients_sort_key_id_idx/);
    expect(planList.join('\n')).not.toContain('TEMP B-TREE');
  });

  it.each([
    ['after', { after: CURSOR }],
    ['before', { before: CURSOR }],
  ])('reads a page of ingredients %s a cursor from the cursor on, in the index', (_, request) => {
    listIngredientPage(database, { pageParam: request, search: '' });
    const planList = lastPlan();

    // A seek from the cursor, not a walk of the index from its start.
    expect(planList[0]).toMatch(
      /^SEARCH ingredients USING (COVERING )?INDEX ingredients_sort_key_id_idx \(/,
    );
    expect(planList.join('\n')).not.toContain('TEMP B-TREE');
  });

  it('looks for a similar ingredient by turning each saved name into words once', () => {
    findSimilarIngredient(database, 'bouteille de vin rouge assez bon');

    // The 16 replace() of one key in words, not 16 per word form (32 forms here).
    expect(lastQuery()?.query.match(/replace\(/g)).toHaveLength(16);
  });

  it('picks a random dish without filters in the (kind, sort_key, id) index', () => {
    pickRandomRecipeId(database, { ingredientIdList: [], kind: 'dish' }, { random: () => 0 });

    expect(lastPlan()).toStrictEqual([
      expect.stringMatching(
        /^SEARCH recipes USING COVERING INDEX recipes_kind_sort_key_id_idx \(kind=\?\)/,
      ),
    ]);
  });

  const COOKED_INDEX =
    /^SEARCH cooked_meals USING COVERING INDEX cooked_meals_recipe_cooked_at_idx/;

  it('skips the recently cooked recipes with one lookup of the meal index each', () => {
    pickRandomRecipeId(
      database,
      { ingredientIdList: [], kind: 'dish' },
      { random: () => 0, skipCookedSince: 1 },
    );
    const planList = lastPlan();

    expect(planList[0]).toMatch(
      /^SEARCH recipes USING COVERING INDEX recipes_kind_sort_key_id_idx \(kind=\?\)/,
    );
    expect(planList).toContainEqual(
      expect.stringMatching(
        /^SEARCH cooked_meals USING COVERING INDEX cooked_meals_recipe_cooked_at_idx \(recipe_id=\? AND cooked_at>\?\)/,
      ),
    );
  });

  it('picks the recipe cooked longest ago with the meal index when all were cooked recently', () => {
    markCooked(database, 1, Date.now());
    queryList = [];
    pickRandomRecipeId(
      database,
      { ingredientIdList: [], kind: 'dish' },
      { random: () => 0, skipCookedSince: 1 },
    );

    expect(lastQuery()?.query).toContain('max("cooked_meals"."cooked_at")');
    expect(lastPlan()).toContainEqual(expect.stringMatching(COOKED_INDEX));
  });

  it('reads the last time a recipe was cooked from the end of the meal index', () => {
    getLastCookedMeal(database, 1);

    expect(lastPlan()).toStrictEqual([
      expect.stringMatching(
        /^SEARCH cooked_meals USING COVERING INDEX cooked_meals_recipe_cooked_at_idx \(recipe_id=\?\)/,
      ),
    ]);
  });

  it('reads the shopping list from the picked meals by sync id, then their links', () => {
    listShoppingLines(database, ['aaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbb']);
    const planList = lastPlan();

    expect(planList).toContainEqual(
      expect.stringMatching(/^SEARCH recipes USING (COVERING )?INDEX recipes_sync_id_unique/),
    );
    expect(planList).toContainEqual(
      expect.stringMatching(
        /^SEARCH recipe_ingredients USING INDEX sqlite_autoindex\S+ \(recipe_id=\?\)/,
      ),
    );
    expect(planList).toContainEqual(
      expect.stringMatching(/^SEARCH ingredients USING INTEGER PRIMARY KEY/),
    );
    expect(planList).not.toContainEqual(expect.stringMatching(/^SCAN/));
  });

  it('suggests used ingredients by checking one link each', () => {
    suggestIngredients(database, { excludeIdList: [], isUsedOnly: true, limit: 12, search: '' });

    expect(lastQuery()?.query).toContain('exists (select 1 from "recipe_ingredients"');
    expect(lastPlan()).toContainEqual(
      expect.stringMatching(/^SEARCH recipe_ingredients EXISTS USING COVERING INDEX/),
    );
  });

  it('counts ingredient usages with the ingredient index', () => {
    listIngredientPage(database, { pageParam: null, search: '' });

    expect(lastPlan()).toContainEqual(expect.stringMatching(INGREDIENT_INDEX));
  });

  it('reads filtered recipe pages in index order and counts ingredients with the primary key', () => {
    listRecipePage(database, {
      filters: {
        course: 'main',
        ingredientIdList: [],
        kind: 'dish',
        search: 'so',
        season: 'winter',
      },
      pageParam: { after: CURSOR },
    });
    const planList = lastPlan();

    expect(planList[0]).toMatch(
      /^SEARCH recipes USING INDEX recipes_kind_sort_key_id_idx \(kind=\? AND sort_key>\?\)/,
    );
    expect(planList).toContainEqual(
      expect.stringMatching(/^SEARCH recipe_ingredients USING COVERING INDEX sqlite_autoindex/),
    );
    expect(planList.join('\n')).not.toContain('TEMP B-TREE');
  });

  it('starts recipe pages filtered by ingredients from the recipes using them', () => {
    // Every filter on. The selected ingredients are the most selective: SQLite reads the recipes
    // using them (covering index), then those recipes by primary key, and sorts only them.
    listRecipePage(database, {
      filters: {
        course: 'main',
        ingredientIdList: [carrotId],
        kind: 'dish',
        search: 'so',
        season: 'winter',
      },
      pageParam: { after: CURSOR },
    });

    expect(lastPlan()).toStrictEqual([
      expect.stringMatching(/^SEARCH recipes USING INTEGER PRIMARY KEY/),
      'LIST SUBQUERY 2',
      expect.stringMatching(INGREDIENT_INDEX),
      'CORRELATED SCALAR SUBQUERY 1',
      expect.stringMatching(/^SEARCH recipe_ingredients USING COVERING INDEX sqlite_autoindex/),
      'USE TEMP B-TREE FOR ORDER BY',
    ]);
  });

  it('reads a recipe card by primary key, its ingredients counted on the covering key', () => {
    getRecipeCard(database, 1);

    expect(lastPlan()).toStrictEqual([
      expect.stringMatching(/^SEARCH recipes USING INTEGER PRIMARY KEY/),
      'CORRELATED SCALAR SUBQUERY 1',
      expect.stringMatching(
        /^SEARCH recipe_ingredients USING COVERING INDEX sqlite_autoindex\S+ \(recipe_id=\?\)/,
      ),
    ]);
  });

  it('reads a recipe ingredients by primary key', () => {
    getRecipe(database, 1);

    expect(lastPlan()).toStrictEqual([
      // Not covering: each link's quantity (amount, unit) is read from its row.
      expect.stringMatching(
        /^SEARCH recipe_ingredients USING INDEX sqlite_autoindex\S+ \(recipe_id=\?\)/,
      ),
      expect.stringMatching(/^SEARCH ingredients USING INTEGER PRIMARY KEY/),
      // Sorting one recipe's few ingredients by name: a small, bounded sort.
      'USE TEMP B-TREE FOR ORDER BY',
    ]);
  });

  it.each([
    [
      'counts',
      () => countRecipes(database, { ingredientIdList: [1, 2], kind: 'dish', season: 'winter' }),
    ],
    [
      'picks',
      () =>
        pickRandomRecipeId(
          database,
          { ingredientIdList: [1], kind: 'dish', season: 'winter' },
          { excludedId: 1, random: () => 0 },
        ),
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
    expect(lastQuery()?.query).toMatch(/limit \?$/);
  });

  it.each(['ingredients', 'recipes', 'cooked_meals'])(
    'finds the %s to push in their partial index of rows to push, in its order',
    async (table) => {
      // A server with nothing new, that accepts everything.
      const api: SyncApi = {
        getServerInfo: () => Promise.resolve(undefined),
        listAccounts: () => Promise.resolve([]),
        listChanges: () => Promise.resolve([]),
        recipePhotoUrl: () => Promise.resolve(''),
        refreshToken: () => Promise.resolve({ accountId: 'a00000000000001', token: 'token' }),
        sendDeletion: () => Promise.resolve('saved'),
        setRecipePhoto: () => Promise.resolve({ name: '' }),
        upsert: () => Promise.resolve('saved'),
      };
      await synchronize(database, api, INITIAL_CURSORS);
      const pushQuery = queryList.find(({ query }) =>
        query.includes(
          `from "${table}" where "${table}"."server_version" is not "${table}"."updated_at" order by`,
        ),
      );
      const planList = planOf(pushQuery);

      // Only the rows to push are in that index: reading all of it reads nothing else.
      expect(planList[0]).toMatch(new RegExp(`^SCAN ${table} USING INDEX ${table}_to_push_idx`));
      expect(planList.join('\n')).not.toContain('TEMP B-TREE');
    },
  );

  it('reads the next page of recipes to push from the last one sent, in the index', async () => {
    for (let index = 0; index < 60; index++) {
      saveRecipe(database, {
        ingredientIdList: [],
        instructions: '',
        kind: 'dish',
        season: 'both',
        title: `Recipe ${index}`,
      });
    }
    const api: SyncApi = {
      getServerInfo: () => Promise.resolve(undefined),
      listAccounts: () => Promise.resolve([]),
      listChanges: () => Promise.resolve([]),
      recipePhotoUrl: () => Promise.resolve(''),
      refreshToken: () => Promise.resolve({ accountId: 'a00000000000001', token: 'token' }),
      sendDeletion: () => Promise.resolve('saved'),
      setRecipePhoto: () => Promise.resolve({ name: '' }),
      upsert: () => Promise.resolve('saved'),
    };
    await synchronize(database, api, INITIAL_CURSORS);
    const nextPageQuery = queryList.find(({ query }) =>
      query.includes('and ("recipes"."updated_at", "recipes"."id") >'),
    );

    expect(planOf(nextPageQuery)).toStrictEqual([
      expect.stringMatching(/^SEARCH recipes USING INDEX recipes_to_push_idx \(/),
    ]);
  });
});
