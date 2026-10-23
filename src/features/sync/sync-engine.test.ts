import { asc, eq } from 'drizzle-orm';
import type { Phone } from '@/test/sync-scenarios';
import { PAGE_SIZE } from '@/db/pagination';
import { accounts, cookedMeals, recipes } from '@/db/schema';
import {
  deleteIngredient,
  findIngredientByName,
} from '@/features/ingredients/db/ingredient-queries';
import {
  getLastCookedMeal,
  markCooked,
  removeCookedMeal,
} from '@/features/meal-history/db/cooked-meal-queries';
import { deleteRecipe, getRecipeSyncId, saveRecipe } from '@/features/recipes/db/recipe-queries';
import { toIngredientSyncId } from '@/lib/sync-id';
import { toNameKey } from '@/lib/text';
import { createFakeSyncServer } from '@/test/fake-sync-server';
import {
  addRecipe,
  cookedDatesOf,
  describeSyncScenarios,
  lastCookedAtOf,
  recipeOf,
  titlesOf,
} from '@/test/sync-scenarios';
import { createTestConnection } from '@/test/test-database';
import type { SyncApi } from './sync-api';
import { createSyncApi, signIn } from './sync-api';
import { countPendingChanges, INITIAL_CURSORS, synchronize } from './sync-engine';

const ACCOUNT = { email: 'home@example.org', password: 'test-password' };
const SERVER_URL = 'https://sync.example.org';

describe('synchronize', () => {
  let server: ReturnType<typeof createFakeSyncServer>;
  let phoneA: Phone;
  let phoneB: Phone;

  beforeEach(() => {
    server = createFakeSyncServer(ACCOUNT);
    phoneA = { cursors: INITIAL_CURSORS, db: createTestConnection().db };
    phoneB = { cursors: INITIAL_CURSORS, db: createTestConnection().db };
  });

  const signInPhone = async () => {
    const { token } = await signIn({ ...ACCOUNT, fetch: server.fetch, serverUrl: SERVER_URL });
    return token;
  };
  const sync = async (phone: Phone) => {
    const api = createSyncApi({
      fetch: server.fetch,
      serverUrl: SERVER_URL,
      token: await signInPhone(),
    });
    phone.cursors = await synchronize(phone.db, api, phone.cursors);
  };

  it('takes the rows changed before the last push of an older app as on the server', async () => {
    addRecipe(phoneA, 'Soup', ['Leek']);
    await sync(phoneA);
    const beforeList = [...server.collection('recipes').values()];
    // As an app from before server versions left it: none kept, and the time of its last push.
    phoneA.db.update(recipes).set({ serverVersion: null }).run();
    phoneA.cursors = {
      ...phoneA.cursors,
      pushedFrom: Date.now() + 1,
      serverVersions: 'legacy',
    };

    expect(countPendingChanges(phoneA.db, phoneA.cursors)).toBe(0);

    await sync(phoneA);

    expect([...server.collection('recipes').values()]).toStrictEqual(beforeList);
    expect(phoneA.cursors.serverVersions).toBe('kept');
    expect(countPendingChanges(phoneA.db, phoneA.cursors)).toBe(0);
  });

  it('sends everything to a server it connects to, even rows another server has', async () => {
    addRecipe(phoneA, 'Soup', ['Leek']);
    await sync(phoneA);
    server = createFakeSyncServer(ACCOUNT);
    phoneA.cursors = INITIAL_CURSORS;

    await sync(phoneA);

    expect(server.collection('recipes').size).toBe(1);
    expect(server.collection('ingredients').size).toBe(1);
  });

  it('skips rows of the server it cannot use', async () => {
    addRecipe(phoneA, 'Soup');
    await sync(phoneA);
    // Rows a real server refuses to store, written directly.
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

  it('keeps only the usable quantities a server sends', async () => {
    addRecipe(phoneA, 'Soup', ['Carrot', 'Leek', 'Salt']);
    await sync(phoneA);
    // Ingredient sync ids derive from the name.
    const syncIdOf = (name: string) => toIngredientSyncId(toNameKey(name));
    const recipe = server.collection('recipes').values().next().value!;
    server.collection('recipes').set(recipe.id, {
      ...recipe,
      quantities: {
        [syncIdOf('Carrot')]: { amount: 'lots', unit: 'kg' },
        [syncIdOf('Leek')]: { amount: 3, unit: 'cubit' },
        [syncIdOf('Salt')]: 'a pinch',
      },
    });

    await sync(phoneB);

    expect(
      recipeOf(phoneB, 'Soup')?.ingredientList.map(({ name, quantity }) => ({ name, quantity })),
    ).toStrictEqual([
      { name: 'Carrot', quantity: undefined },
      { name: 'Leek', quantity: { amount: 3 } },
      { name: 'Salt', quantity: undefined },
    ]);
  });

  it('takes the author the server gives a recipe it already has, without pushing it back', async () => {
    addRecipe(phoneA, 'Soup');
    addRecipe(phoneA, 'Stew');
    await sync(phoneA);
    await sync(phoneB);
    // As the server migration does for the recipes from before authors: another account, or none,
    // with a new `updated` and the same `modified`.
    const rowMap = server.collection('recipes');
    const [soup, stew] = [...rowMap.values()];
    const updated = '2026-01-02 00:00:00.000Z';
    rowMap.set(soup!.id, { ...soup!, created_by: 'b00000000000002', updated });
    rowMap.set(stew!.id, { ...stew!, created_by: '', updated });
    const authorOf = (phone: Phone, title: string) =>
      phone.db
        .select({ createdBy: recipes.createdBy })
        .from(recipes)
        .where(eq(recipes.title, title))
        .get()?.createdBy;

    await sync(phoneB);

    expect(authorOf(phoneB, 'soup')).toBe('b00000000000002');
    // A server without an author never takes one away.
    expect(authorOf(phoneB, 'stew')).toBe(server.accountId);
    expect(countPendingChanges(phoneB.db, phoneB.cursors)).toBe(0);

    // Nor does a newer version without one.
    const storedStew = rowMap.get(stew!.id)!;
    rowMap.set(stew!.id, {
      ...storedStew,
      modified: storedStew.modified + 1,
      title: 'beef stew',
      updated: '2026-01-03 00:00:00.000Z',
    });
    await sync(phoneB);

    expect(authorOf(phoneB, 'beef stew')).toBe(server.accountId);
  });

  it('keeps a recipe added here as the phone’s own when a newer version comes without an author', async () => {
    const id = addRecipe(phoneA, 'Soup');
    // Written on the server meanwhile without an author (e.g. by the admin), and newer.
    const syncId = getRecipeSyncId(phoneA.db, id)!;
    server.collection('recipes').set(syncId, {
      course: 'main',
      deleted: 0,
      id: syncId,
      ingredients: [],
      instructions: '',
      modified: Date.now() + 60_000,
      season: 'both',
      title: 'pea soup',
      updated: '2026-01-02 00:00:00.000Z',
    });

    await sync(phoneA);

    const author = phoneA.db
      .select({ createdBy: recipes.createdBy })
      .from(recipes)
      .where(eq(recipes.id, id))
      .get()?.createdBy;

    expect(recipeOf(phoneA, 'Pea soup')).toBeDefined();
    expect(author).toBeNull();
  });

  it('forgets an account the server no longer lists, and renames the others', async () => {
    server.accountMap.set('b00000000000002', { id: 'b00000000000002', name: 'Alice' });
    server.accountMap.set('c00000000000003', { id: 'c00000000000003', name: 'Bob' });
    await sync(phoneA);
    server.accountMap.delete('c00000000000003');
    server.accountMap.set('b00000000000002', { id: 'b00000000000002', name: '  Alicia ' });

    await sync(phoneA);

    expect(phoneA.db.select().from(accounts).orderBy(asc(accounts.id)).all()).toStrictEqual([
      { id: server.accountId, name: '' },
      { id: 'b00000000000002', name: 'Alicia' },
    ]);
  });

  it('fails without changing anything when the server is unreachable', async () => {
    addRecipe(phoneA, 'Soup');
    const token = await signInPhone();
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

  it('counts the changes the next sync sends', async () => {
    const pendingCount = (phone: Phone) => countPendingChanges(phone.db, phone.cursors);
    const id = addRecipe(phoneA, 'Soup', ['Leek']);

    // The recipe and its new ingredient.
    expect(pendingCount(phoneA)).toBe(2);

    await sync(phoneA);
    await sync(phoneB);

    expect(pendingCount(phoneA)).toBe(0);
    // Pulled from the server: nothing to send back.
    expect(pendingCount(phoneB)).toBe(0);

    // Edited there: a change to send.
    phoneB.db
      .update(recipes)
      .set({ title: 'leek soup', updatedAt: Date.now() + 1 })
      .where(eq(recipes.title, 'soup'))
      .run();

    expect(pendingCount(phoneB)).toBe(1);

    deleteRecipe(phoneA.db, id);

    expect(pendingCount(phoneA)).toBe(1);
  });

  it('skips meals of the server it cannot use, and those of recipes it does not have', async () => {
    const soupId = addRecipe(phoneA, 'Soup');
    await sync(phoneA);
    const [soup] = [...server.collection('recipes').values()];
    const meal = (id: string, fields: object) => ({
      cooked_at: 1000,
      deleted: 0,
      id,
      modified: 1,
      recipe: soup!.id,
      updated: '2026-06-01 00:00:00.000Z',
      ...fields,
    });
    const rowMap = server.collection('cooked_meals');
    rowMap.set('aaaaaaaaaaaaaaa', meal('aaaaaaaaaaaaaaa', { recipe: 'not a sync id' }));
    rowMap.set('bbbbbbbbbbbbbbb', meal('bbbbbbbbbbbbbbb', { cooked_at: -5 }));
    rowMap.set('ccccccccccccccc', meal('ccccccccccccccc', { cooked_at: '12' }));
    // A recipe deleted since (or never pushed): no meal without its recipe.
    rowMap.set('ddddddddddddddd', meal('ddddddddddddddd', { recipe: 'fffffffffffffff' }));
    rowMap.set('eeeeeeeeeeeeeee', meal('eeeeeeeeeeeeeee', { cooked_at: 2000 }));

    await sync(phoneA);

    expect(getLastCookedMeal(phoneA.db, soupId)?.cookedAt).toBe(2000);
    expect(phoneA.db.select().from(cookedMeals).all()).toHaveLength(1);
  });

  it('counts a photo waiting to be uploaded or removed as a change waiting for the sync', async () => {
    const soupId = saveRecipe(phoneA.db, {
      ingredientIdList: [],
      instructions: '',
      photo: { file: 'a.jpg' },
      season: 'both',
      title: 'Soup',
    });
    // Synced without photos: the recipe is pushed, its photo isn't.
    await sync(phoneA);

    expect(countPendingChanges(phoneA.db, phoneA.cursors)).toBe(1);

    phoneA.db
      .update(recipes)
      .set({ photoSynced: 'photo_x.jpg' })
      .where(eq(recipes.id, soupId))
      .run();

    expect(countPendingChanges(phoneA.db, phoneA.cursors)).toBe(0);

    phoneA.db.update(recipes).set({ photoFile: null }).where(eq(recipes.id, soupId)).run();

    expect(countPendingChanges(phoneA.db, phoneA.cursors)).toBe(1);
  });

  it('counts a meal cooked or removed as a change waiting for the sync', async () => {
    const soupId = addRecipe(phoneA, 'Soup');
    await sync(phoneA);

    const mealId = markCooked(phoneA.db, soupId, 1000);

    expect(countPendingChanges(phoneA.db, phoneA.cursors)).toBe(1);

    removeCookedMeal(phoneA.db, mealId);

    expect(countPendingChanges(phoneA.db, phoneA.cursors)).toBe(1);
  });

  describe('while another phone writes during the pull', () => {
    // Server times later than the fake server's own (2026-01-01 00:00:00.001Z on).
    const LATER = '2026-06-01 00:00:00.000Z';
    const LATER_STILL = '2026-06-01 00:00:00.001Z';

    // Calls `write` once, before the server reads its `count`-th list of `table`.
    const beforeList = (table: string, count: number, write: () => void) => {
      let listCount = 0;
      server.setBeforeList((name) => {
        listCount += name === table ? 1 : 0;
        if (name === table && listCount === count) {
          write();
        }
      });
    };
    const beforeRecipeList = (count: number, write: () => void) => {
      beforeList('recipes', count, write);
    };

    it('gets an ingredient and the recipe using it, written while recipes were pulled', async () => {
      const basil = toIngredientSyncId(toNameKey('Basil'));
      // Pushed by another phone, ingredients first, after this one has pulled the ingredients.
      const write = jest.fn(() => {
        server.collection('ingredients').set(basil, {
          deleted: 0,
          id: basil,
          modified: 1,
          name: 'basil',
          updated: LATER,
        });
        server.collection('recipes').set('abcabcabcabcabc', {
          course: 'main',
          deleted: 0,
          id: 'abcabcabcabcabc',
          ingredients: [basil],
          instructions: '',
          modified: 1,
          quantities: {},
          season: 'both',
          title: 'pesto',
          updated: LATER_STILL,
        });
      });
      beforeRecipeList(1, write);

      await sync(phoneA);

      expect(write).toHaveBeenCalledTimes(1);
      expect(recipeOf(phoneA, 'Pesto')?.ingredientList).toMatchObject([{ name: 'Basil' }]);
    });

    it('gets back the older meals of a recipe brought back while meals were pulled', async () => {
      const soupId = addRecipe(phoneA, 'Soup');
      markCooked(phoneA.db, soupId, 1000);
      const { syncId: soupSyncId } = phoneA.db.select().from(recipes).get()!;
      await sync(phoneA);
      await sync(phoneB);
      // A later meal, pulled by A since: A's pull of meals is past Soup's.
      markCooked(phoneB.db, addRecipe(phoneB, 'Pie'), 2000);
      await sync(phoneB);
      await sync(phoneA);
      deleteRecipe(phoneA.db, soupId);
      // Once A has pulled the recipes: another phone edits Soup (after A's deletion) and cooks it.
      const write = jest.fn(() => {
        const soup = server.collection('recipes').get(soupSyncId)!;
        server.collection('recipes').set(soupSyncId, {
          ...soup,
          instructions: 'Simmer.',
          modified: Date.now() + 60_000,
          updated: LATER,
        });
        server.collection('cooked_meals').set('defdefdefdefdef', {
          cooked_at: 3000,
          deleted: 0,
          id: 'defdefdefdefdef',
          modified: 1,
          recipe: soupSyncId,
          updated: LATER_STILL,
        });
      });
      beforeList('cooked_meals', 1, write);

      await sync(phoneA);

      const soup = recipeOf(phoneA, 'Soup');

      expect(write).toHaveBeenCalledTimes(1);
      expect(soup?.instructions).toBe('Simmer.');
      expect(cookedDatesOf(phoneA, 'Soup')).toStrictEqual([1000, 3000]);
    });

    it('gets a meal and the recipe it was cooked from, written while meals were pulled', async () => {
      // Pushed by another phone, its recipe first, after this one has pulled the recipes.
      const write = jest.fn(() => {
        server.collection('recipes').set('abcabcabcabcabc', {
          course: 'main',
          deleted: 0,
          id: 'abcabcabcabcabc',
          ingredients: [],
          instructions: '',
          modified: 1,
          quantities: {},
          season: 'both',
          title: 'pesto',
          updated: LATER,
        });
        server.collection('cooked_meals').set('defdefdefdefdef', {
          cooked_at: 1_700_000_000_000,
          deleted: 0,
          id: 'defdefdefdefdef',
          modified: 1,
          recipe: 'abcabcabcabcabc',
          updated: LATER_STILL,
        });
      });
      beforeList('cooked_meals', 1, write);

      await sync(phoneA);

      expect(write).toHaveBeenCalledTimes(1);
      expect(lastCookedAtOf(phoneA, 'Pesto')).toBe(1_700_000_000_000);
    });

    it('deletes an ingredient whose last recipe is deleted in the recipes pulled again', async () => {
      const omeletteId = addRecipe(phoneA, 'Omelette', ['Œufs']);
      await sync(phoneA);
      await sync(phoneB);
      const omeletteSyncId = getRecipeSyncId(phoneA.db, omeletteId)!;
      const omelette = server.collection('recipes').get(omeletteSyncId)!;
      deleteRecipe(phoneA.db, omeletteId);
      deleteIngredient(phoneA.db, findIngredientByName(phoneA.db, 'Œufs')!.id);
      await sync(phoneA);
      const deletedOmelette = server.collection('recipes').get(omeletteSyncId)!;
      // B pulls the ingredient's deletion, but the omelette's comes only with the recipes pulled
      // again for a meal of a recipe it doesn't have.
      server.collection('recipes').set(omeletteSyncId, omelette);
      const write = jest.fn(() => {
        server.collection('recipes').set(omeletteSyncId, { ...deletedOmelette, updated: LATER });
        server.collection('cooked_meals').set('defdefdefdefdef', {
          cooked_at: 1000,
          deleted: 0,
          id: 'defdefdefdefdef',
          modified: 1,
          recipe: 'abcabcabcabcabc',
          updated: LATER_STILL,
        });
      });
      beforeList('cooked_meals', 1, write);

      await sync(phoneB);

      const eggsSyncId = toIngredientSyncId(toNameKey('Œufs'));

      expect(write).toHaveBeenCalledTimes(1);
      expect(titlesOf(phoneB)).toStrictEqual([]);
      expect(findIngredientByName(phoneB.db, 'Œufs')).toBeUndefined();
      expect(server.collection('ingredients').get(eggsSyncId)?.deleted).toBeGreaterThan(0);
    });

    it('gets every row of a long pull when one of them changes meanwhile', async () => {
      for (let index = 0; index < 60; index++) {
        addRecipe(phoneA, `Recipe ${String(index).padStart(2, '0')}`);
      }
      await sync(phoneA);
      // Once B has read its first page, that page's first row is changed again: it moves to the end.
      const write = jest.fn(() => {
        const rowMap = server.collection('recipes');
        const [first] = [...rowMap.values()].toSorted((a, b) => a.updated.localeCompare(b.updated));
        rowMap.set(first!.id, { ...first!, updated: LATER });
      });
      beforeRecipeList(2, write);

      await sync(phoneB);

      expect(write).toHaveBeenCalledTimes(1);
      expect(titlesOf(phoneB)).toHaveLength(60);
    });
  });

  describe('with a server sending odd lists', () => {
    const ingredientRow = (index: number) => ({
      deleted: 0,
      id: String(index).padStart(15, '0'),
      modified: 1,
      name: `Ingredient ${index}`,
      updated: '2026-01-01 00:00:00.000Z',
    });
    const apiListing = (listChanges: SyncApi['listChanges']): SyncApi => ({
      getServerInfo: () => Promise.resolve(undefined),
      listAccounts: () => Promise.resolve([]),
      listChanges,
      recipePhotoUrl: () => Promise.resolve(''),
      refreshToken: () => Promise.resolve({ accountId: 'a00000000000001', token: 'token' }),
      sendDeletion: () => Promise.resolve('saved'),
      setRecipePhoto: () => Promise.resolve({ name: '' }),
      upsert: () => Promise.resolve('saved'),
    });

    it('skips what is not a row', async () => {
      // Recipes too (it has no title: skipped there).
      const api = apiListing(() => Promise.resolve([null, 'row', [], ingredientRow(1)]));

      await synchronize(phoneA.db, api, INITIAL_CURSORS);

      expect(findIngredientByName(phoneA.db, 'Ingredient 1')).toBeDefined();
    });

    it('stops a server that sends the same rows again', async () => {
      const pageList = Array.from({ length: PAGE_SIZE }, (_, index) => ingredientRow(index));
      const api = apiListing(() => Promise.resolve(pageList));

      await expect(synchronize(phoneA.db, api, INITIAL_CURSORS)).rejects.toMatchObject({
        kind: 'failed',
      });
    });
  });

  it('leaves out a quantity too large once converted', async () => {
    addRecipe(phoneA, 'Soup', ['Carrot']);
    await sync(phoneA);
    const recipe = server.collection('recipes').values().next().value!;
    server.collection('recipes').set(recipe.id, {
      ...recipe,
      // 10^11 g: more than a quantity can be.
      quantities: {
        [toIngredientSyncId(toNameKey('Carrot'))]: { amount: 100_000_000, unit: 'kg' },
      },
    });

    await sync(phoneB);

    expect(
      recipeOf(phoneB, 'Soup')?.ingredientList.map(({ name, quantity }) => ({ name, quantity })),
    ).toStrictEqual([{ name: 'Carrot', quantity: undefined }]);
  });

  // The same scenarios run against a real PocketBase in sync-engine.pocketbase.test.ts.
  describe('with the test server', () => {
    describeSyncScenarios(() => {
      const fakeServer = createFakeSyncServer(ACCOUNT);
      return Promise.resolve({
        account: ACCOUNT,
        addAccount: (name: string) => {
          const id = `b${String(fakeServer.accountMap.size).padStart(14, '0')}`;
          fakeServer.accountMap.set(id, { id, name });
          return Promise.resolve(id);
        },
        fetch: fakeServer.fetch,
        rowsOf: (table) => Promise.resolve([...fakeServer.collection(table).values()]),
        serverUrl: SERVER_URL,
      });
    });
  });
});
