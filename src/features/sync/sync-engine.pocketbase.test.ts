/**
@jest-environment node
*/
import type { SyncTestServer } from '@/test/sync-scenarios';
import { nodeFetch } from '@/test/node-fetch';
import {
  createPocketBaseServer,
  POCKETBASE_URL,
  readPocketBaseSettings,
  setRateLimitExclusions,
} from '@/test/pocketbase-test-server';
import { describeSyncScenarios } from '@/test/sync-scenarios';
import { checkServerVersion } from './server-version';
import { createSyncApi, signIn } from './sync-api';

// The sync against a real PocketBase with server/migrations: the scenarios of sync-engine.test.ts,
// and the server behaviours its fake server (src/test/fake-sync-server.ts) mirrors. Started by
// `npm run test:pocketbase` (and CI); a plain `npm test` leaves this file out (jest.config.js).
const ROW = { deleted: 0, ingredients: [], modified: 1000, title: 'Soup' };

describe('synchronize with PocketBase', () => {
  describeSyncScenarios(() => createPocketBaseServer(POCKETBASE_URL ?? ''));

  describe('server behaviour the app relies on', () => {
    let server: SyncTestServer;
    let accountId: string;
    let token: string;

    beforeEach(async () => {
      server = await createPocketBaseServer(POCKETBASE_URL ?? '');
      ({ accountId, token } = await signIn({
        ...server.account,
        fetch: nodeFetch,
        serverUrl: server.serverUrl,
      }));
    });

    const call = (path: string, init: RequestInit & { token?: string } = {}) =>
      nodeFetch(`${server.serverUrl}/api/${path}`, {
        ...init,
        headers: { Authorization: init.token ?? '', 'Content-Type': 'application/json' },
      });
    const createRecipe = (id: string, asToken = token) =>
      call('collections/recipes/records', {
        body: JSON.stringify({ ...ROW, id }),
        method: 'POST',
        token: asToken,
      });

    describe('with the rate limits applied to this machine', () => {
      // This machine is left out of the limits for the other tests (scripts/pocketbase-server.sh).
      beforeEach(async () => {
        await setRateLimitExclusions(server.serverUrl, []);
      });

      afterEach(async () => {
        await setRateLimitExclusions(server.serverUrl, ['127.0.0.1', '::1']);
      });

      it('limits password sign-ins to 5 a minute, not token renewals nor syncs (server/migrations)', async () => {
        const signInStatusList: number[] = [];
        for (let attempt = 0; attempt < 6; attempt++) {
          const response = await call('collections/users/auth-with-password', {
            body: JSON.stringify({ identity: server.account.email, password: 'wrong' }),
            method: 'POST',
          });
          signInStatusList.push(response.status);
        }
        const refreshed = await call('collections/users/auth-refresh', { method: 'POST', token });
        const listed = await call('collections/recipes/records', { token });

        expect(signInStatusList).toStrictEqual([400, 400, 400, 400, 400, 429]);
        expect(refreshed.status).toBe(200);
        expect(listed.status).toBe(200);
        await expect(readPocketBaseSettings(server.serverUrl)).resolves.toMatchObject({
          rateLimits: {
            enabled: true,
            rules: [{ audience: '', duration: 60, label: '*:auth', maxRequests: 5 }],
          },
          trustedProxy: { headers: [] },
        });
      });
    });

    it('tells this app its versions match (server/hooks)', async () => {
      const api = createSyncApi({ fetch: nodeFetch, serverUrl: server.serverUrl, token: '' });

      expect(checkServerVersion(await api.getServerInfo())).toBe('compatible');
    });

    it('treats a refused token as a guest: empty lists, refused creates and updates', async () => {
      await createRecipe('aaaaaaaaaaaaaaa');

      const list = await call('collections/recipes/records', { token: 'refused' });
      const created = await createRecipe('bbbbbbbbbbbbbbb', 'refused');
      const updated = await call('collections/recipes/records/aaaaaaaaaaaaaaa', {
        body: JSON.stringify({ ...ROW, modified: 2000 }),
        method: 'PATCH',
        token: 'refused',
      });
      const refreshed = await call('collections/users/auth-refresh', {
        method: 'POST',
        token: 'refused',
      });

      expect(list.status).toBe(200);
      await expect(list.json()).resolves.toMatchObject({ items: [] });
      expect(created.status).toBe(400);
      expect(updated.status).toBe(404);
      expect(refreshed.status).toBe(401);
    });

    it('refuses an update older than the stored row, and a create with an existing id', async () => {
      await createRecipe('aaaaaaaaaaaaaaa');

      const older = await call('collections/recipes/records/aaaaaaaaaaaaaaa', {
        body: JSON.stringify({ ...ROW, modified: 999, title: 'Older' }),
        method: 'PATCH',
        token,
      });
      const duplicate = await createRecipe('aaaaaaaaaaaaaaa');

      expect(older.status).toBe(404);
      expect(duplicate.status).toBe(400);
      await expect(duplicate.json()).resolves.toMatchObject({
        data: { id: { code: 'validation_not_unique' } },
      });
      await expect(server.rowsOf('recipes')).resolves.toMatchObject([{ title: 'Soup' }]);
    });

    it('gives a recipe the account that creates it as author, which no request changes (server/hooks)', async () => {
      // An author sent by a request is replaced, on a create as on an update.
      const created = await call('collections/recipes/records', {
        body: JSON.stringify({ ...ROW, created_by: 'zzzzzzzzzzzzzzz', id: 'aaaaaaaaaaaaaaa' }),
        method: 'POST',
        token,
      });
      const updated = await call('collections/recipes/records/aaaaaaaaaaaaaaa', {
        body: JSON.stringify({ ...ROW, created_by: '', modified: 2000, title: 'Stew' }),
        method: 'PATCH',
        token,
      });

      expect(created.status).toBe(200);
      expect(updated.status).toBe(200);
      await expect(server.rowsOf('recipes')).resolves.toMatchObject([
        { created_by: accountId, title: 'Stew' },
      ]);
    });

    it('lists the accounts’ names to a signed-in account, not their emails (server/migrations)', async () => {
      const aliceId = await server.addAccount('Alice');

      const listed = await call('collections/users/records?sort=-name', { token });
      const asGuest = await call('collections/users/records');

      const { items: itemList } = (await listed.json()) as { items: Record<string, unknown>[] };

      expect(itemList).toMatchObject([{ id: aliceId, name: 'Alice' }, { id: accountId }]);
      expect(itemList[0]).not.toHaveProperty('email');
      await expect(asGuest.json()).resolves.toMatchObject({ items: [] });
    });

    it('sets `updated` in a format that sorts as text in time order (the pull cursor)', async () => {
      await createRecipe('aaaaaaaaaaaaaaa');

      const [row] = await server.rowsOf('recipes');

      expect(row?.updated).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
