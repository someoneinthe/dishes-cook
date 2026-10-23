import { getItem, setItem } from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import type { AppDatabase, DatabaseConnection } from '@/db/types';
import { recipes } from '@/db/schema';
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
  let connection: DatabaseConnection;
  let database: AppDatabase;
  let server: ReturnType<typeof createFakeSyncServer>;
  let otherServer: ReturnType<typeof createFakeSyncServer>;

  beforeEach(() => {
    connection = createTestConnection();
    database = connection.db;
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
    await connect(connection, { ...ACCOUNT, serverUrl: SERVER_URL });
    const otherPhone = createTestConnection();
    // Stored by an older version: one time for both tables, here later than every row.
    Storage.setItemSync(
      'sync',
      JSON.stringify({
        cursors: { pulledUntil: '2099-01-01 00:00:00.000Z', pushedFrom: Date.now() },
        email: ACCOUNT.email,
        serverUrl: SERVER_URL,
      }),
    );
    const { token } = await signIn({ ...ACCOUNT, fetch: server.fetch, serverUrl: SERVER_URL });
    setItem('sync-token', token);

    await syncNow(otherPhone);

    expect(titlesOf({ cursors: INITIAL_CURSORS, db: otherPhone.db })).toStrictEqual(['Soup']);
  });

  it('keeps the account signed in to, and learns it on the next sync when connected before', async () => {
    await connect(connection, { ...ACCOUNT, serverUrl: SERVER_URL });

    expect(getSyncState().connection).toStrictEqual({
      accountId: server.accountId,
      email: ACCOUNT.email,
      serverUrl: SERVER_URL,
    });

    // Stored by an older version: no account id.
    Storage.setItemSync(
      'sync',
      JSON.stringify({ cursors: INITIAL_CURSORS, email: ACCOUNT.email, serverUrl: SERVER_URL }),
    );
    await syncNow(connection);

    expect(getSyncState().connection).toMatchObject({ accountId: server.accountId });
  });

  it('refreshes the screens once per sync, however many pages it pulls', async () => {
    const otherPhone = createTestConnection();
    for (let index = 0; index < 120; index++) {
      saveRecipe(otherPhone.db, {
        ingredientIdList: [],
        instructions: '',
        season: 'both',
        title: `Recipe ${index}`,
      });
    }
    await connect(otherPhone, { ...ACCOUNT, serverUrl: SERVER_URL });
    await disconnect();
    const listener = jest.fn();
    connection.subscribe(listener);

    await connect(connection, { ...ACCOUNT, serverUrl: SERVER_URL });

    expect(database.select().from(recipes).all()).toHaveLength(120);
    expect(listener.mock.calls).toStrictEqual([['sync']]);
  });

  it('asks to sign in again when the token is missing (a phone restored from a backup)', async () => {
    Storage.setItemSync('sync', JSON.stringify({ email: ACCOUNT.email, serverUrl: SERVER_URL }));

    await syncNow(connection);

    expect(getSyncState()).toMatchObject({
      connection: { serverUrl: SERVER_URL },
      error: 'unauthorized',
    });
  });

  it('keeps nothing of a sync running when the phone stops syncing', async () => {
    await connect(connection, { ...ACCOUNT, serverUrl: SERVER_URL });
    addSoup();

    const sync = syncNow(connection);
    await disconnect();
    await sync;

    expect(getItem('sync-token')).toBeNull();
    expect(getSyncState()).toMatchObject({ connection: undefined, error: undefined });
  });

  it('saves nothing of a connect overtaken while signing in', async () => {
    const connecting = connect(connection, { ...ACCOUNT, serverUrl: SERVER_URL });
    await disconnect();
    await connecting;

    expect(getItem('sync-token')).toBeNull();
    expect(getSyncState().connection).toBeUndefined();

    const connectingAgain = connect(connection, { ...ACCOUNT, serverUrl: SERVER_URL });
    await connect(connection, { ...ACCOUNT, serverUrl: OTHER_SERVER_URL });
    await connectingAgain;

    expect(getSyncState().connection).toMatchObject({ serverUrl: OTHER_SERVER_URL });
  });

  it('syncs with the new server when connected to it during a sync', async () => {
    await connect(connection, { ...ACCOUNT, serverUrl: SERVER_URL });
    addSoup();

    const sync = syncNow(connection);
    await connect(connection, { ...ACCOUNT, serverUrl: OTHER_SERVER_URL });
    await sync;

    expect(getSyncState()).toMatchObject({
      connection: { serverUrl: OTHER_SERVER_URL },
      error: undefined,
    });
    expect([...otherServer.collection('recipes').values()]).toMatchObject([{ title: 'soup' }]);
  });
});
