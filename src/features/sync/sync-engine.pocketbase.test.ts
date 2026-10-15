/**
@jest-environment node
*/
import type { SyncTestServer } from '@/test/sync-scenarios';
import { nodeFetch } from '@/test/node-fetch';
import { createPocketBaseServer, POCKETBASE_URL } from '@/test/pocketbase-test-server';
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
    let token: string;

    beforeEach(async () => {
      server = await createPocketBaseServer(POCKETBASE_URL ?? '');
      token = await signIn({ ...server.account, fetch: nodeFetch, serverUrl: server.serverUrl });
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

    it('sets `updated` in a format that sorts as text in time order (the pull cursor)', async () => {
      await createRecipe('aaaaaaaaaaaaaaa');

      const [row] = await server.rowsOf('recipes');

      expect(row?.updated).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
