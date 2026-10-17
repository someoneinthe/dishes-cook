import { env } from 'node:process';
import type { SyncedTable } from '@/db/schema';
import type { StoredRow, SyncTestServer } from './sync-scenarios';
import { nodeFetch } from './node-fetch';

// The throwaway PocketBase started by scripts/test-pocketbase.sh (server/migrations applied), or
// undefined when the tests run without one.
export const POCKETBASE_URL = environment('POCKETBASE_URL');

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

// The server's settings, as its superuser reads them.
export async function readPocketBaseSettings(serverUrl: string): Promise<unknown> {
  const response = await nodeFetch(`${serverUrl}/api/settings`, {
    headers: { Authorization: await signInSuperuser(serverUrl) },
  });
  if (!response.ok) {
    throw new Error(`PocketBase settings: ${response.status}`);
  }
  return (await response.json()) as unknown;
}

// A variable set by scripts/test-pocketbase.sh. Read as unknown: CI's types give env values `any`.
function environment(name: string): string | undefined {
  const value: unknown = env[name];
  return typeof value === 'string' ? value : undefined;
}

async function signInSuperuser(serverUrl: string): Promise<string> {
  const response = await nodeFetch(`${serverUrl}/api/collections/_superusers/auth-with-password`, {
    body: JSON.stringify({
      identity: environment('POCKETBASE_SUPERUSER_EMAIL') ?? '',
      password: environment('POCKETBASE_SUPERUSER_PASSWORD') ?? '',
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`PocketBase superuser sign-in: ${response.status}`);
  }
  return ((await response.json()) as { token: string }).token;
}
