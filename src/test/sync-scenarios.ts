import { asc, eq } from 'drizzle-orm';
import type { SyncedTable } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { SyncCursors } from '@/features/sync/sync-engine';
import { cookedMeals, ingredients, recipes, syncDeletions } from '@/db/schema';
import {
  deleteIngredient,
  findIngredientByName,
  findOrCreateIngredient,
} from '@/features/ingredients/db/ingredient-queries';
import {
  getLastCookedMeal,
  markCooked,
  removeCookedMeal,
} from '@/features/meal-history/db/cooked-meal-queries';
import { deleteRecipe, getRecipe, saveRecipe } from '@/features/recipes/db/recipe-queries';
import { createSyncApi, signIn } from '@/features/sync/sync-api';
import { INITIAL_CURSORS, synchronize } from '@/features/sync/sync-engine';
import { toDisplayName } from '@/lib/text';
import { createTestConnection } from './test-database';

export type Phone = { cursors: SyncCursors; db: AppDatabase };

export type StoredRow = Record<string, unknown> & { id: string; updated: string };

// A sync server for the scenarios below: the in-memory fake (sync-engine.test.ts) or a real
// PocketBase (sync-engine.pocketbase.test.ts), empty at the start of each scenario.
export type SyncTestServer = Readonly<{
  account: Readonly<{ email: string; password: string }>;
  fetch: typeof fetch;
  // The rows stored in a collection, deleted ones included.
  rowsOf: (table: SyncedTable) => Promise<StoredRow[]>;
  serverUrl: string;
}>;

export function addRecipe(phone: Phone, title: string, ingredientNameList: string[] = []) {
  return saveRecipe(phone.db, {
    ingredientIdList: ingredientNameList.map((name) => findOrCreateIngredient(phone.db, name).id),
    instructions: '',
    season: 'both',
    title,
  });
}

// Two phones syncing with the same server: what the sync must do whatever the server is.
export function describeSyncScenarios(createServer: () => Promise<SyncTestServer>) {
  let server: SyncTestServer;
  let phoneA: Phone;
  let phoneB: Phone;

  beforeEach(async () => {
    server = await createServer();
    phoneA = { cursors: INITIAL_CURSORS, db: createTestConnection().db };
    phoneB = { cursors: INITIAL_CURSORS, db: createTestConnection().db };
  });

  const sync = async (phone: Phone) => {
    const { account, fetch, serverUrl } = server;
    const token = await signIn({ ...account, fetch, serverUrl });
    const api = createSyncApi({ fetch, serverUrl, token });
    phone.cursors = await synchronize(phone.db, api, phone.cursors);
  };
  // A, then B, then A again: both have everything.
  const syncBoth = async () => {
    await sync(phoneA);
    await sync(phoneB);
    await sync(phoneA);
  };

  it('merges the recipes of two phones, with one copy of an ingredient both have', async () => {
    addRecipe(phoneA, 'Leek soup', ['Leek', 'Potato']);
    addRecipe(phoneB, 'Leek pie', ['leek', 'Pastry']);

    await syncBoth();

    for (const phone of [phoneA, phoneB]) {
      expect(titlesOf(phone)).toStrictEqual(['Leek pie', 'Leek soup']);
      expect(ingredientNamesOf(phone)).toHaveLength(3);
      expect(
        recipeOf(phone, 'Leek pie')?.ingredientList.map(({ name }) => name.toLowerCase()),
      ).toStrictEqual(['leek', 'pastry']);
    }

    await expect(server.rowsOf('ingredients')).resolves.toHaveLength(3);
  });

  it('brings a change made on one phone to the other', async () => {
    const id = addRecipe(phoneA, 'Soup', ['Leek']);
    await syncBoth();

    saveRecipe(
      phoneA.db,
      {
        course: 'starter',
        ingredientIdList: [findOrCreateIngredient(phoneA.db, 'Carrot').id],
        instructions: 'Simmer.',
        season: 'winter',
        title: 'Carrot soup',
      },
      id,
    );
    await sync(phoneA);
    await sync(phoneB);

    expect(recipeOf(phoneB, 'Carrot soup')).toMatchObject({
      course: 'starter',
      ingredientList: [{ name: 'Carrot' }],
      instructions: 'Simmer.',
      season: 'winter',
    });
    expect(titlesOf(phoneB)).toStrictEqual(['Carrot soup']);
  });

  it('brings the quantities of a recipe to the other phone, and their changes', async () => {
    const carrotId = findOrCreateIngredient(phoneA.db, 'Carrot').id;
    const leekId = findOrCreateIngredient(phoneA.db, 'Leek').id;
    const saltId = findOrCreateIngredient(phoneA.db, 'Salt').id;
    const input = {
      ingredientIdList: [carrotId, leekId, saltId],
      instructions: '',
      season: 'both' as const,
      title: 'Soup',
    };
    const id = saveRecipe(phoneA.db, {
      ...input,
      quantities: new Map([
        [carrotId, { amount: 0.5, unit: 'kg' as const }],
        [leekId, { amount: 2 }],
      ]),
    });
    await syncBoth();

    expect(recipeOf(phoneB, 'Soup')?.ingredientList).toMatchObject([
      { name: 'Carrot', quantity: { amount: 500, unit: 'g' } },
      { name: 'Leek', quantity: { amount: 2 } },
      { name: 'Salt' },
    ]);
    expect(recipeOf(phoneB, 'Soup')?.ingredientList[2]).not.toHaveProperty('quantity');

    saveRecipe(
      phoneA.db,
      { ...input, quantities: new Map([[saltId, { amount: 1, unit: 'pinch' as const }]]) },
      id,
    );
    await sync(phoneA);
    await sync(phoneB);

    expect(recipeOf(phoneB, 'Soup')?.ingredientList.map(({ quantity }) => quantity)).toStrictEqual([
      undefined,
      undefined,
      { amount: 1, unit: 'pinch' },
    ]);
  });

  it('keeps the newest change when both phones changed the same recipe', async () => {
    addRecipe(phoneA, 'Soup');
    await syncBoth();
    const setTitle = (phone: Phone, title: string, updatedAt: number) =>
      // As the app saves a title: in lowercase.
      phone.db
        .update(recipes)
        .set({ sortKey: title.toLowerCase(), title: title.toLowerCase(), updatedAt })
        .run();
    const later = Date.now() + 60_000;
    setTitle(phoneB, 'Soup by B', later + 1000);
    setTitle(phoneA, 'Soup by A', later);

    await sync(phoneB);
    // A's change is older than the server's: kept there, and A takes B's.
    await sync(phoneA);
    await sync(phoneB);

    expect(titlesOf(phoneA)).toStrictEqual(['Soup by b']);
    expect(titlesOf(phoneB)).toStrictEqual(['Soup by b']);
  });

  it('deletes on the other phone a recipe deleted on one, then forgets the deletion', async () => {
    const id = addRecipe(phoneA, 'Soup', ['Leek']);
    addRecipe(phoneA, 'Salad');
    await syncBoth();

    deleteRecipe(phoneA.db, id);
    await sync(phoneA);
    await sync(phoneB);

    expect(titlesOf(phoneB)).toStrictEqual(['Salad']);
    // The ingredient isn't deleted with the recipe.
    // Names are saved in lowercase (and shown with a capital first letter).
    expect(ingredientNamesOf(phoneB)).toStrictEqual(['leek']);
    expect(phoneA.db.select().from(syncDeletions).all()).toStrictEqual([]);
  });

  it('deletes on the other phone an unused ingredient deleted on one', async () => {
    findOrCreateIngredient(phoneA.db, 'Basil');
    await syncBoth();

    expect(deleteIngredient(phoneA.db, findIngredientByName(phoneA.db, 'Basil')!.id)).toBe(
      'deleted',
    );

    await sync(phoneA);
    await sync(phoneB);

    expect(ingredientNamesOf(phoneB)).toStrictEqual([]);
  });

  it('keeps an ingredient deleted on one phone while a recipe on the other uses it', async () => {
    findOrCreateIngredient(phoneA.db, 'Basil');
    await syncBoth();
    deleteIngredient(phoneA.db, findIngredientByName(phoneA.db, 'Basil')!.id);
    await sync(phoneA);
    // Meanwhile, B made a recipe with it.
    addRecipe(phoneB, 'Pesto', ['Basil']);

    await sync(phoneB);
    await sync(phoneA);

    expect(recipeOf(phoneB, 'Pesto')?.ingredientList).toMatchObject([{ name: 'Basil' }]);
    expect(recipeOf(phoneA, 'Pesto')?.ingredientList).toMatchObject([{ name: 'Basil' }]);
  });

  it('pulls and pushes more rows than fit in a page', async () => {
    for (let index = 0; index < 120; index++) {
      addRecipe(phoneA, `Recipe ${String(index).padStart(3, '0')}`, [`Ingredient ${index % 60}`]);
    }

    await sync(phoneA);
    await sync(phoneB);

    expect(titlesOf(phoneB)).toHaveLength(120);
    expect(ingredientNamesOf(phoneB)).toHaveLength(60);
    expect(recipeOf(phoneB, 'Recipe 061')?.ingredientList).toMatchObject([
      { name: 'Ingredient 1' },
    ]);
  });

  it('brings the meal history to the other phone, without changing the recipe', async () => {
    const soupId = addRecipe(phoneA, 'Soup');
    await syncBoth();
    const [recipeBefore] = await server.rowsOf('recipes');

    markCooked(phoneA.db, soupId, Date.UTC(2026, 9, 10, 19));
    markCooked(phoneA.db, soupId, Date.UTC(2026, 9, 16, 19));
    await syncBoth();

    expect(lastCookedAtOf(phoneB, 'Soup')).toBe(Date.UTC(2026, 9, 16, 19));
    await expect(server.rowsOf('cooked_meals')).resolves.toHaveLength(2);
    // Marking it cooked didn't push the recipe again: an edit made on B meanwhile is kept.
    const [recipeAfter] = await server.rowsOf('recipes');
    expect(recipeAfter?.updated).toBe(recipeBefore?.updated);
  });

  it('removes on the other phone a time cooked removed on one', async () => {
    const soupId = addRecipe(phoneA, 'Soup');
    markCooked(phoneA.db, soupId, Date.UTC(2026, 9, 10, 19));
    const lastId = markCooked(phoneA.db, soupId, Date.UTC(2026, 9, 16, 19));
    await syncBoth();

    removeCookedMeal(phoneA.db, lastId);
    await syncBoth();

    expect(lastCookedAtOf(phoneB, 'Soup')).toBe(Date.UTC(2026, 9, 10, 19));
  });

  it('forgets the meals of a recipe deleted on the other phone', async () => {
    const soupId = addRecipe(phoneA, 'Soup');
    markCooked(phoneA.db, soupId, Date.UTC(2026, 9, 16, 19));
    await syncBoth();

    deleteRecipe(phoneA.db, soupId);
    await syncBoth();

    expect(titlesOf(phoneB)).toStrictEqual([]);
    expect(phoneB.db.select().from(cookedMeals).all()).toStrictEqual([]);
  });

  it('only sends the rows changed since the last sync', async () => {
    addRecipe(phoneA, 'Soup');
    // Changed a while ago: not in the same millisecond as the sync below starts.
    phoneA.db
      .update(recipes)
      .set({ updatedAt: Date.now() - 10_000 })
      .run();
    await sync(phoneA);
    const [before] = await server.rowsOf('recipes');

    await sync(phoneA);

    const [after] = await server.rowsOf('recipes');
    expect(after?.updated).toBe(before?.updated);
  });
}

// When the recipe was last cooked on the phone (undefined: never, or no such recipe).
export function lastCookedAtOf(phone: Phone, title: string) {
  const recipe = recipeOf(phone, title);
  return recipe && getLastCookedMeal(phone.db, recipe.id)?.cookedAt;
}

export function recipeOf(phone: Phone, title: string) {
  const row = phone.db
    .select({ id: recipes.id })
    .from(recipes)
    // Saved in lowercase.
    .where(eq(recipes.title, title.toLowerCase()))
    .get();
  return row && getRecipe(phone.db, row.id);
}

export function titlesOf(phone: Phone) {
  return (
    phone.db
      .select({ title: recipes.title })
      .from(recipes)
      .orderBy(asc(recipes.sortKey))
      .all()
      // As shown: titles are saved in lowercase.
      .map(({ title }) => toDisplayName(title))
  );
}

function ingredientNamesOf(phone: Phone) {
  return phone.db
    .select({ name: ingredients.name })
    .from(ingredients)
    .orderBy(asc(ingredients.sortKey))
    .all()
    .map(({ name }) => name);
}
