import type { Phone } from '@/test/sync-scenarios';
import { toIngredientSyncId } from '@/lib/sync-id';
import { toNameKey } from '@/lib/text';
import { createFakeSyncServer } from '@/test/fake-sync-server';
import { addRecipe, describeSyncScenarios, recipeOf, titlesOf } from '@/test/sync-scenarios';
import { createTestConnection } from '@/test/test-database';
import { createSyncApi, signIn } from './sync-api';
import { INITIAL_CURSORS, synchronize } from './sync-engine';

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
