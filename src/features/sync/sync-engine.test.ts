import { asc, eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/types';
import { ingredients, recipes, syncDeletions } from '@/db/schema';
import {
  deleteIngredient,
  findIngredientByName,
  findOrCreateIngredient,
} from '@/features/ingredients/db/ingredient-queries';
import { deleteRecipe, getRecipe, saveRecipe } from '@/features/recipes/db/recipe-queries';
import { createFakeSyncServer } from '@/test/fake-sync-server';
import { createTestConnection } from '@/test/test-database';
import type { SyncCursors } from './sync-engine';
import { createSyncApi, signIn } from './sync-api';
import { INITIAL_CURSORS, synchronize } from './sync-engine';

const ACCOUNT = { email: 'home@example.org', password: 'test-password' };
const SERVER_URL = 'https://sync.example.org';

type Phone = { cursors: SyncCursors; db: AppDatabase };

describe('synchronize', () => {
  let server: ReturnType<typeof createFakeSyncServer>;
  let phoneA: Phone;
  let phoneB: Phone;

  beforeEach(() => {
    server = createFakeSyncServer(ACCOUNT);
    phoneA = { cursors: INITIAL_CURSORS, db: createTestConnection().db };
    phoneB = { cursors: INITIAL_CURSORS, db: createTestConnection().db };
  });

  const sync = async (phone: Phone) => {
    const token = await signIn({ ...ACCOUNT, fetch: server.fetch, serverUrl: SERVER_URL });
    const api = createSyncApi({ fetch: server.fetch, serverUrl: SERVER_URL, token });
    phone.cursors = await synchronize(phone.db, api, phone.cursors);
  };
  // A, then B, then A again: both have everything.
  const syncBoth = async () => {
    await sync(phoneA);
    await sync(phoneB);
    await sync(phoneA);
  };

  const addRecipe = (phone: Phone, title: string, ingredientNameList: string[] = []) =>
    saveRecipe(phone.db, {
      ingredientIdList: ingredientNameList.map((name) => findOrCreateIngredient(phone.db, name).id),
      instructions: '',
      season: 'both',
      title,
    });
  const recipeOf = (phone: Phone, title: string) => {
    const row = phone.db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.title, title))
      .get();
    return row && getRecipe(phone.db, row.id);
  };
  const titlesOf = (phone: Phone) =>
    phone.db
      .select({ title: recipes.title })
      .from(recipes)
      .orderBy(asc(recipes.sortKey))
      .all()
      .map(({ title }) => title);
  const ingredientNamesOf = (phone: Phone) =>
    phone.db
      .select({ name: ingredients.name })
      .from(ingredients)
      .orderBy(asc(ingredients.sortKey))
      .all()
      .map(({ name }) => name);

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

    expect(server.collection('ingredients').size).toBe(3);
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

  it('keeps the newest change when both phones changed the same recipe', async () => {
    addRecipe(phoneA, 'Soup');
    await syncBoth();
    const setTitle = (phone: Phone, title: string, updatedAt: number) =>
      phone.db.update(recipes).set({ sortKey: title.toLowerCase(), title, updatedAt }).run();
    const later = Date.now() + 60_000;
    setTitle(phoneB, 'Soup by B', later + 1000);
    setTitle(phoneA, 'Soup by A', later);

    await sync(phoneB);
    // A's change is older than the server's: kept there, and A takes B's.
    await sync(phoneA);
    await sync(phoneB);

    expect(titlesOf(phoneA)).toStrictEqual(['Soup by B']);
    expect(titlesOf(phoneB)).toStrictEqual(['Soup by B']);
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
    expect(ingredientNamesOf(phoneB)).toStrictEqual(['Leek']);
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

  it('only sends the rows changed since the last sync', async () => {
    addRecipe(phoneA, 'Soup');
    // Changed a while ago: not in the same millisecond as the sync below starts.
    phoneA.db
      .update(recipes)
      .set({ updatedAt: Date.now() - 10_000 })
      .run();
    await sync(phoneA);
    const updatedBefore = server.collection('recipes').values().next().value?.updated;

    await sync(phoneA);

    expect(server.collection('recipes').values().next().value?.updated).toBe(updatedBefore);
  });

  it('skips rows of the server it cannot use', async () => {
    addRecipe(phoneA, 'Soup');
    await sync(phoneA);
    const rowMap = server.collection('recipes');
    rowMap.set('badid', {
      deleted: 0,
      id: 'badid',
      modified: 1,
      title: 'Bad id',
      updated: '2026-01-02',
    });
    rowMap.set('aaaaaaaaaaaaaaa', {
      deleted: 0,
      id: 'aaaaaaaaaaaaaaa',
      modified: 1,
      title: ' '.repeat(3),
      updated: '2026-01-02',
    });
    rowMap.set('bbbbbbbbbbbbbbb', {
      course: 'brunch',
      deleted: 0,
      id: 'bbbbbbbbbbbbbbb',
      ingredients: 'not a list',
      modified: 1,
      season: 'spring',
      title: 'Odd values',
      updated: '2026-01-02',
    });

    await sync(phoneB);

    expect(titlesOf(phoneB)).toStrictEqual(['Odd values', 'Soup']);
    expect(recipeOf(phoneB, 'Odd values')).toMatchObject({
      course: 'main',
      ingredientList: [],
      season: 'both',
    });
  });

  it('fails without changing anything when the server is unreachable', async () => {
    addRecipe(phoneA, 'Soup');
    const token = await signIn({ ...ACCOUNT, fetch: server.fetch, serverUrl: SERVER_URL });
    server.setReachable(false);

    await expect(
      synchronize(
        phoneA.db,
        createSyncApi({ fetch: server.fetch, serverUrl: SERVER_URL, token }),
        INITIAL_CURSORS,
      ),
    ).rejects.toMatchObject({ kind: 'unreachable' });
    expect(titlesOf(phoneA)).toStrictEqual(['Soup']);
  });
});
