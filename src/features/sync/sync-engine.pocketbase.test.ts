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
import { checkServerVersion, SERVER_MIGRATION_LIST } from './server-version';
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

    it('refuses a change at the stored version, but not the same content or a photo (server/migrations)', async () => {
      const recipe = {
        ...ROW,
        id: 'aaaaaaaaaaaaaaa',
        ingredients: ['bbbbbbbbbbbbbbb', 'ccccccccccccccc'],
        quantities: { bbbbbbbbbbbbbbb: { amount: 2 } },
      };
      await call('collections/recipes/records', {
        body: JSON.stringify(recipe),
        method: 'POST',
        token,
      });
      await call('collections/ingredients/records', {
        body: JSON.stringify({ deleted: 0, id: 'bbbbbbbbbbbbbbb', modified: 1000, name: 'eggs' }),
        method: 'POST',
        token,
      });
      const patch = (path: string, body: object) =>
        call(`collections/${path}`, { body: JSON.stringify(body), method: 'PATCH', token });
      const form = new FormData();
      form.append('@jsonPayload', JSON.stringify({ modified: 1000 }));
      form.append('photo', new Blob([new Uint8Array([0xff, 0xd8, 0xff])]), 'photo.jpg');

      const missingIngredient = await patch(`recipes/records/${recipe.id}`, {
        ...recipe,
        ingredients: ['ccccccccccccccc'],
      });
      const otherTitle = await patch(`recipes/records/${recipe.id}`, { ...recipe, title: 'Stew' });
      const otherName = await patch('ingredients/records/bbbbbbbbbbbbbbb', {
        modified: 1000,
        name: 'egg',
      });
      const same = await patch(`recipes/records/${recipe.id}`, recipe);
      const photo = await nodeFetch(
        `${server.serverUrl}/api/collections/recipes/records/${recipe.id}`,
        {
          body: form,
          headers: { Authorization: token },
          method: 'PATCH',
        },
      );
      const newer = await patch(`recipes/records/${recipe.id}`, {
        ...recipe,
        ingredients: [],
        modified: 1001,
      });
      const [stored] = await server.rowsOf('recipes');

      expect([missingIngredient.status, otherTitle.status, otherName.status]).toStrictEqual([
        404, 404, 404,
      ]);
      expect([same.status, photo.status, newer.status]).toStrictEqual([200, 200, 200]);
      expect(stored).toMatchObject({ ingredients: [], title: 'Soup' });
      expect(stored?.photo).toMatch(/^photo_\w+\.jpg$/);
    });

    it('refuses a version more than a day ahead of its clock (server/hooks)', async () => {
      await createRecipe('aaaaaaaaaaaaaaa');
      const twoDaysAhead = Date.now() + 2 * 24 * 60 * 60 * 1000;

      const created = await call('collections/recipes/records', {
        body: JSON.stringify({ ...ROW, id: 'bbbbbbbbbbbbbbb', modified: twoDaysAhead }),
        method: 'POST',
        token,
      });
      const updated = await call('collections/recipes/records/aaaaaaaaaaaaaaa', {
        body: JSON.stringify({ ...ROW, modified: twoDaysAhead }),
        method: 'PATCH',
        token,
      });
      const hourAhead = await call('collections/recipes/records/aaaaaaaaaaaaaaa', {
        body: JSON.stringify({ ...ROW, modified: Date.now() + 60 * 60 * 1000, title: 'Stew' }),
        method: 'PATCH',
        token,
      });

      expect([created.status, updated.status, hourAhead.status]).toStrictEqual([400, 400, 200]);
      await expect(server.rowsOf('recipes')).resolves.toMatchObject([{ title: 'Stew' }]);
    });

    it('lists only the app’s migrations, not PocketBase’s own (server/hooks)', async () => {
      const api = createSyncApi({ fetch: nodeFetch, serverUrl: server.serverUrl, token: '' });

      const info = await api.getServerInfo();

      expect(info?.migrations).toStrictEqual(SERVER_MIGRATION_LIST);
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
