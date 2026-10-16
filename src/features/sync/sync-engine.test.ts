import type { Phone } from '@/test/sync-scenarios';
import { PAGE_SIZE } from '@/db/pagination';
import { recipes } from '@/db/schema';
import { findIngredientByName } from '@/features/ingredients/db/ingredient-queries';
import { deleteRecipe } from '@/features/recipes/db/recipe-queries';
import { toIngredientSyncId } from '@/lib/sync-id';
import { toNameKey } from '@/lib/text';
import { createFakeSyncServer } from '@/test/fake-sync-server';
import { addRecipe, describeSyncScenarios, recipeOf, titlesOf } from '@/test/sync-scenarios';
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

  const signInPhone = () => signIn({ ...ACCOUNT, fetch: server.fetch, serverUrl: SERVER_URL });
  const sync = async (phone: Phone) => {
    const api = createSyncApi({
      fetch: server.fetch,
      serverUrl: SERVER_URL,
      token: await signInPhone(),
    });
    phone.cursors = await synchronize(phone.db, api, phone.cursors);
  };

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
    const pendingCount = (phone: Phone) => countPendingChanges(phone.db, phone.cursors.pushedFrom);
    // Syncs started a millisecond later: a change made in the same millisecond as a sync's start is
    // pushed again by the next one, so it would still count.
    const syncLater = async (phone: Phone) => {
      const api = createSyncApi({
        fetch: server.fetch,
        serverUrl: SERVER_URL,
        token: await signInPhone(),
      });
      phone.cursors = await synchronize(phone.db, api, phone.cursors, () => Date.now() + 1);
    };
    const id = addRecipe(phoneA, 'Soup', ['Leek']);

    // The recipe and its new ingredient.
    expect(pendingCount(phoneA)).toBe(2);

    await syncLater(phoneA);
    await syncLater(phoneB);

    expect(pendingCount(phoneA)).toBe(0);
    // Pulled from the server: nothing to send back.
    expect(pendingCount(phoneB)).toBe(0);

    // Pulled from a phone whose clock is a minute ahead: not a change of this one.
    phoneB.db
      .update(recipes)
      .set({ updatedAt: Date.now() + 60_000 })
      .run();

    expect(pendingCount(phoneB)).toBe(0);

    deleteRecipe(phoneA.db, id);

    expect(pendingCount(phoneA)).toBe(1);
  });

  describe('while another phone writes during the pull', () => {
    // Server times later than the fake server's own (2026-01-01 00:00:00.001Z on).
    const LATER = '2026-06-01 00:00:00.000Z';
    const LATER_STILL = '2026-06-01 00:00:00.001Z';

    // Calls `write` once, before the server reads its `count`-th list of recipes.
    const beforeRecipeList = (count: number, write: () => void) => {
      let recipeListCount = 0;
      server.setBeforeList((name) => {
        recipeListCount += name === 'recipes' ? 1 : 0;
        if (name === 'recipes' && recipeListCount === count) {
          write();
        }
      });
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
      listChanges,
      refreshToken: () => Promise.resolve('token'),
      sendDeletion: () => Promise.resolve('saved'),
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
        fetch: fakeServer.fetch,
        rowsOf: (table) => Promise.resolve([...fakeServer.collection(table).values()]),
        serverUrl: SERVER_URL,
      });
    });
  });
});
