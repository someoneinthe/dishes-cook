import { getItem, setItem } from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import type { AppDatabase } from '@/db/types';
import { saveRecipe } from '@/features/recipes/db/recipe-queries';
import { createFakeSyncServer } from '@/test/fake-sync-server';
import { titlesOf } from '@/test/sync-scenarios';
import { createTestConnection } from '@/test/test-database';
import { signIn } from './sync-api';
import { INITIAL_CURSORS } from './sync-engine';
import { connect, disconnect, getSyncState, syncNow } from './sync-store';

const ACCOUNT = { email: 'home@example.org', password: 'test-password' };
const SERVER_URL = 'https://sync.example.org';
const OTHER_SERVER_HOST = 'other.example.org';
const OTHER_SERVER_URL = `https://${OTHER_SERVER_HOST}`;

describe('sync store', () => {
  let database: AppDatabase;
  let server: ReturnType<typeof createFakeSyncServer>;
  let otherServer: ReturnType<typeof createFakeSyncServer>;

  beforeEach(() => {
    database = createTestConnection().db;
    server = createFakeSyncServer(ACCOUNT);
    otherServer = createFakeSyncServer(ACCOUNT);
    // Each address is its own server.
    jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const { host } = new URL(input instanceof Request ? input.url : String(input));
      return (host === OTHER_SERVER_HOST ? otherServer : server).fetch(input, init);
    });
  });

  afterEach(async () => {
    await disconnect();
    jest.restoreAllMocks();
  });

  const addSoup = () =>
    saveRecipe(database, { ingredientIdList: [], instructions: '', season: 'both', title: 'Soup' });

  it('pulls everything again once after an update from a single pull time', async () => {
    addSoup();
    await connect(database, { ...ACCOUNT, serverUrl: SERVER_URL });
    const otherPhone = createTestConnection().db;
    // Stored by an older version: one time for both tables, here later than every row.
    Storage.setItemSync(
      'sync',
      JSON.stringify({
        cursors: { pulledUntil: '2099-01-01 00:00:00.000Z', pushedFrom: Date.now() },
        email: ACCOUNT.email,
        serverUrl: SERVER_URL,
      }),
    );
    setItem('sync-token', await signIn({ ...ACCOUNT, fetch: server.fetch, serverUrl: SERVER_URL }));

    await syncNow(otherPhone);

    expect(titlesOf({ cursors: INITIAL_CURSORS, db: otherPhone })).toStrictEqual(['Soup']);
  });

  it('asks to sign in again when the token is missing (a phone restored from a backup)', async () => {
    Storage.setItemSync('sync', JSON.stringify({ email: ACCOUNT.email, serverUrl: SERVER_URL }));

    await syncNow(database);

    expect(getSyncState()).toMatchObject({
      connection: { serverUrl: SERVER_URL },
      error: 'unauthorized',
    });
  });

  it('keeps nothing of a sync running when the phone stops syncing', async () => {
    await connect(database, { ...ACCOUNT, serverUrl: SERVER_URL });
    addSoup();

    const sync = syncNow(database);
    await disconnect();
    await sync;

    expect(getItem('sync-token')).toBeNull();
    expect(getSyncState()).toMatchObject({ connection: undefined, error: undefined });
  });

  it('saves nothing of a connect overtaken while signing in', async () => {
    const connecting = connect(database, { ...ACCOUNT, serverUrl: SERVER_URL });
    await disconnect();
    await connecting;

    expect(getItem('sync-token')).toBeNull();
    expect(getSyncState().connection).toBeUndefined();

    const connectingAgain = connect(database, { ...ACCOUNT, serverUrl: SERVER_URL });
    await connect(database, { ...ACCOUNT, serverUrl: OTHER_SERVER_URL });
    await connectingAgain;

    expect(getSyncState().connection).toMatchObject({ serverUrl: OTHER_SERVER_URL });
  });

  it('syncs with the new server when connected to it during a sync', async () => {
    await connect(database, { ...ACCOUNT, serverUrl: SERVER_URL });
    addSoup();

    const sync = syncNow(database);
    await connect(database, { ...ACCOUNT, serverUrl: OTHER_SERVER_URL });
    await sync;

    expect(getSyncState()).toMatchObject({
      connection: { serverUrl: OTHER_SERVER_URL },
      error: undefined,
    });
    expect([...otherServer.collection('recipes').values()]).toMatchObject([{ title: 'soup' }]);
  });
});
