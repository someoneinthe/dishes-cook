import { createFakeSyncServer } from '@/test/fake-sync-server';
import type { ServerIngredient } from './sync-api';
import {
  createSyncApi,
  isInsecureServerUrl,
  normalizeServerUrl,
  serverHost,
  signIn,
  SyncError,
} from './sync-api';

const ACCOUNT = { email: 'home@example.org', password: 'test-password' };
const SERVER_URL = 'https://sync.example.org';

describe('syncApi', () => {
  describe('normalizeServerUrl', () => {
    it.each([
      ['sync.example.org', 'https://sync.example.org'],
      [' sync.example.org/ ', 'https://sync.example.org'],
      ['192.168.1.10:8090', 'https://192.168.1.10:8090'],
      ['HTTPS://Sync.Example.org//', 'HTTPS://Sync.Example.org'],
      ['https://sync.example.org/pb', 'https://sync.example.org/pb'],
    ])('reads %p as %p', (typed, expected) => {
      expect(normalizeServerUrl(typed)).toBe(expected);
    });

    it.each([[''], [' '.repeat(3)], ['not an address'], ['https://'], ['ftp://sync.example.org']])(
      'refuses %p',
      (typed) => {
        expect(normalizeServerUrl(typed)).toBeUndefined();
      },
    );
  });

  describe('isInsecureServerUrl', () => {
    it.each([
      // Plain HTTP to another machine is what this check is about.
      // eslint-disable-next-line unicorn/prefer-https
      ['http://sync.example.org', true],
      ['HTTP://sync.example.org:8090', true],
      ['https://sync.example.org', false],
      ['http://localhost:8091', false],
    ])('tells whether %p sends the password in clear: %p', (serverUrl, isInsecure) => {
      expect(isInsecureServerUrl(serverUrl)).toBe(isInsecure);
    });
  });

  describe('serverHost', () => {
    it('keeps the host and port', () => {
      expect(serverHost('https://sync.example.org:8443/pb')).toBe('sync.example.org:8443');
      expect(serverHost('https://sync.example.org')).toBe('sync.example.org');
    });
  });

  describe('requests', () => {
    let server: ReturnType<typeof createFakeSyncServer>;

    beforeEach(() => {
      server = createFakeSyncServer(ACCOUNT);
    });

    const signedInApi = async () =>
      createSyncApi({
        fetch: server.fetch,
        serverUrl: SERVER_URL,
        token: await signIn({ ...ACCOUNT, fetch: server.fetch, serverUrl: SERVER_URL }),
      });

    it("reads the server's versions, or nothing from a server without them", async () => {
      const api = await signedInApi();

      await expect(api.getServerInfo()).resolves.toMatchObject({ minimumAppSyncVersion: 1 });

      server.setServerInfo(undefined);

      await expect(api.getServerInfo()).resolves.toBeUndefined();
    });

    it('refuses a wrong password as unauthorized', async () => {
      await expect(
        signIn({ ...ACCOUNT, fetch: server.fetch, password: 'wrong', serverUrl: SERVER_URL }),
      ).rejects.toMatchObject({ kind: 'unauthorized' });
    });

    it('reports an unreachable server', async () => {
      server.setReachable(false);

      await expect(
        signIn({ ...ACCOUNT, fetch: server.fetch, serverUrl: SERVER_URL }),
      ).rejects.toMatchObject({
        kind: 'unreachable',
      });
    });

    it('creates a row, then updates it', async () => {
      const api = await signedInApi();

      await expect(
        api.upsert('ingredients', '0123456789abcde', { deleted: 0, modified: 1, name: 'Leek' }),
      ).resolves.toBe('saved');
      await expect(
        api.upsert('ingredients', '0123456789abcde', { deleted: 0, modified: 2, name: 'Leeks' }),
      ).resolves.toBe('saved');
      expect(server.collection('ingredients').get('0123456789abcde')).toMatchObject({
        modified: 2,
        name: 'Leeks',
      });
    });

    it("keeps the server's row when it's newer", async () => {
      const api = await signedInApi();
      await api.upsert('ingredients', '0123456789abcde', { deleted: 0, modified: 5, name: 'Leek' });

      await expect(
        api.upsert('ingredients', '0123456789abcde', { deleted: 0, modified: 4, name: 'Old' }),
      ).resolves.toBe('kept-newer');
      await expect(api.sendDeletion('ingredients', '0123456789abcde', 3)).resolves.toBe(
        'kept-newer',
      );
      expect(server.collection('ingredients').get('0123456789abcde')).toMatchObject({
        deleted: 0,
        name: 'Leek',
      });
    });

    it('fails a push refused for a token the server no longer accepts', async () => {
      const api = createSyncApi({ fetch: server.fetch, serverUrl: SERVER_URL, token: 'expired' });

      await expect(
        api.upsert('ingredients', '0123456789abcde', { deleted: 0, modified: 1, name: 'Leek' }),
      ).rejects.toBeInstanceOf(SyncError);
      await expect(api.refreshToken()).rejects.toMatchObject({ kind: 'unauthorized' });
    });

    it('lists the rows written since a time, or after a row, oldest first', async () => {
      const api = await signedInApi();
      await api.upsert('ingredients', 'aaaaaaaaaaaaaaa', { deleted: 0, modified: 1, name: 'A' });
      await api.upsert('ingredients', 'bbbbbbbbbbbbbbb', { deleted: 0, modified: 1, name: 'B' });
      await api.upsert('ingredients', 'ccccccccccccccc', { deleted: 0, modified: 1, name: 'C' });
      const namesOf = (itemList: unknown[]) =>
        (itemList as { name: string }[]).map(({ name }) => name);
      const allList = (await api.listChanges('ingredients', { since: '' })) as ServerIngredient[];

      expect(namesOf(allList)).toStrictEqual(['A', 'B', 'C']);

      const [, second] = allList;

      expect(
        namesOf(await api.listChanges('ingredients', { since: second!.updated })),
      ).toStrictEqual(['B', 'C']);
      expect(namesOf(await api.listChanges('ingredients', { after: second! }))).toStrictEqual([
        'C',
      ]);
    });
  });
});
