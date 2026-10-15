import type { SyncedTable } from '@/db/schema';
import type { StoredRow, SyncTestServer } from './sync-scenarios';
import { nodeFetch } from './node-fetch';

// The throwaway PocketBase started by scripts/test-pocketbase.sh (server/migrations applied), or
// undefined when the tests run without one.
export const POCKETBASE_URL = process.env.POCKETBASE_URL;

const ACCOUNT = { email: 'home@example.org', password: 'test-password' };
const SYNCED_TABLES: SyncedTable[] = ['ingredients', 'recipes'];

// The real server, emptied: its collections truncated, with an account for the phones.
export async function createPocketBaseServer(serverUrl: string): Promise<SyncTestServer> {
  const superuserToken = await signInSuperuser(serverUrl);
  const call = async (path: string, init: RequestInit = {}) => {
    const response = await nodeFetch(`${serverUrl}/api/${path}`, {
      ...init,
      headers: { Authorization: superuserToken, 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`PocketBase ${init.method ?? 'GET'} ${path}: ${response.status}`);
    }
    return response.status === 204 ? undefined : ((await response.json()) as unknown);
  };

  for (const table of SYNCED_TABLES) {
    await call(`collections/${table}/truncate`, { method: 'DELETE' });
  }
  await call('collections/users/truncate', { method: 'DELETE' });
  await call('collections/users/records', {
    body: JSON.stringify({ ...ACCOUNT, passwordConfirm: ACCOUNT.password }),
    method: 'POST',
  });

  return {
    account: ACCOUNT,
    fetch: nodeFetch,
    rowsOf: async (table) => {
      const rowList: StoredRow[] = [];
      for (let page = 1; ; page++) {
        const body = (await call(
          `collections/${table}/records?page=${page}&perPage=500&skipTotal=1&sort=updated,id`,
        )) as { items: StoredRow[] };
        rowList.push(...body.items);
        if (body.items.length < 500) {
          return rowList;
        }
      }
    },
    serverUrl,
  };
}

async function signInSuperuser(serverUrl: string): Promise<string> {
  const response = await nodeFetch(`${serverUrl}/api/collections/_superusers/auth-with-password`, {
    body: JSON.stringify({
      identity: process.env.POCKETBASE_SUPERUSER_EMAIL,
      password: process.env.POCKETBASE_SUPERUSER_PASSWORD,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`PocketBase superuser sign-in: ${response.status}`);
  }
  return ((await response.json()) as { token: string }).token;
}
