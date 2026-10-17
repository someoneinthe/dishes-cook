import type { SyncedTable } from '@/db/schema';
import { PAGE_SIZE } from '@/db/pagination';
import type { ServerInfo } from './server-version';

// The sync server's HTTP API (PocketBase, see docs/sync.md), with plain `fetch`: the few calls the
// sync needs don't justify an SDK.

// Where a page of pulled rows starts, in the (updated, id) order: at a time ('' = from the start),
// or right after a row (the last one of the previous page). Pages follow each other by key, not
// by number: a row written meanwhile moves to the end instead of shifting the next pages.
export type PullPosition = Readonly<
  { after: Readonly<{ id: string; updated: string }> } | { since: string }
>;

// What a push sends: the row's fields, without what the server sets.
export type RowUpload<Table extends SyncedTable> = Omit<
  ServerRowOf<Table>,
  'created' | 'id' | 'updated'
>;

// One time a recipe was cooked (the meal history).
export type ServerCookedMeal = Readonly<{
  // When it was cooked, in ms.
  cooked_at: number;
  // The recipe's sync id.
  recipe: string;
}> &
  ServerRow;

export type ServerIngredient = Readonly<{ name: string }> & ServerRow;

export type ServerRecipe = Readonly<{
  course: string;
  // Sync ids of its ingredients.
  ingredients: unknown;
  instructions: string;
  // Quantities by ingredient sync id: { amount, unit? } (see server/migrations).
  quantities: unknown;
  season: string;
  title: string;
}> &
  ServerRow;

// Every synced row carries these, next to its own fields.
export type ServerRow = Readonly<{
  // Set by the server when the row is created, in the format of `updated`.
  created?: unknown;
  // Deletion time in ms; 0 while the row exists.
  deleted: number;
  id: string;
  // The app's last change time, in ms: the newest wins.
  modified: number;
  // Set by the server on every write ("2026-10-14 18:03:59.794Z"): pulls resume after it.
  updated: string;
}>;

export type ServerRowOf<Table extends SyncedTable> = Table extends 'ingredients'
  ? ServerIngredient
  : Table extends 'recipes'
    ? ServerRecipe
    : ServerCookedMeal;

export type SyncApi = Readonly<{
  // The server's migrations and the oldest app it accepts; undefined for a server without that
  // endpoint (installed before it existed): too old for this app.
  getServerInfo: () => Promise<ServerInfo | undefined>;
  // Up to PAGE_SIZE rows written on the server from `position` on, oldest first.
  listChanges: <Table extends SyncedTable>(
    table: Table,
    position: PullPosition,
  ) => Promise<unknown[]>;
  // A new sign-in token for the same account (tokens expire after a year).
  refreshToken: () => Promise<string>;
  // Marks a row deleted; 'kept-newer' when it's missing or changed later.
  sendDeletion: (table: SyncedTable, id: string, deletedAt: number) => Promise<UpsertResult>;
  upsert: <Table extends SyncedTable>(
    table: Table,
    id: string,
    row: RowUpload<Table>,
  ) => Promise<UpsertResult>;
}>;

// Why a sync failed:
// - app-outdated: the server asks for a newer app;
// - failed: anything else the server answered;
// - server-outdated: the server lacks what this app version needs;
// - unauthorized: the account or its sign-in token was refused (sign in again);
// - unreachable: no answer (not on the home network, server down, wrong address).
export type SyncErrorKind =
  'app-outdated' | 'failed' | 'server-outdated' | 'unauthorized' | 'unreachable';

// 'kept-newer': the server already has a newer change of this row, which the next pull brings.
export type UpsertResult = 'kept-newer' | 'saved';

type Fetch = typeof fetch;

export class SyncError extends Error {
  readonly kind: SyncErrorKind;

  constructor(kind: SyncErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'SyncError';
  }
}

const TIMEOUT_MS = 15_000;

export function createSyncApi(
  options: Readonly<{ fetch?: Fetch; serverUrl: string; token: string }>,
): SyncApi {
  const fetchFunction = options.fetch ?? fetch;
  const records = (table: SyncedTable) =>
    apiUrl(options.serverUrl, 'collections', table, 'records');
  const send = (url: string, init: RequestInit = {}) =>
    request(fetchFunction, url, {
      ...init,
      headers: { ...init.headers, Authorization: options.token },
    });

  const patch = async (table: SyncedTable, id: string, body: object) => {
    const response = await send(`${records(table)}/${id}`, {
      body: JSON.stringify(body),
      method: 'PATCH',
    });
    if (response.status === 404) {
      // Missing, or refused by the update rule because the server's row is newer.
      return 'not-updated' as const;
    }
    await readJson(response);
    return 'saved' as const;
  };

  return {
    getServerInfo: async () => {
      const response = await send(apiUrl(options.serverUrl, 'dishes-cook', 'server'));
      // 404: a server installed before the endpoint existed.
      return response.status === 404 ? undefined : readServerInfo(response);
    },
    listChanges: async (table, position) => {
      const query = new URLSearchParams({
        perPage: String(PAGE_SIZE),
        skipTotal: '1',
        sort: 'updated,id',
      });
      const filter = pullFilter(position);
      if (filter) {
        query.set('filter', filter);
      }
      const body = await readJson(await send(`${records(table)}?${query.toString()}`));
      const itemList: unknown = (body as { items?: unknown }).items;
      if (!Array.isArray(itemList)) {
        throw new SyncError('failed', `Unexpected list of ${table}`);
      }
      // Never more than asked for, whatever the server sends.
      return itemList.slice(0, PAGE_SIZE) as unknown[];
    },
    refreshToken: async () => {
      const url = apiUrl(options.serverUrl, 'collections', 'users', 'auth-refresh');
      return readToken(await readJson(await send(url, { method: 'POST' })));
    },
    sendDeletion: async (table, id, deletedAt) =>
      (await patch(table, id, { deleted: deletedAt, modified: deletedAt })) === 'saved'
        ? 'saved'
        : 'kept-newer',
    upsert: async (table, id, row) => {
      if ((await patch(table, id, row)) === 'saved') {
        return 'saved';
      }
      const response = await send(records(table), {
        body: JSON.stringify({ ...row, id }),
        method: 'POST',
      });
      // The id exists: the PATCH was refused because the server's row is newer. Any other 400
      // (e.g. not signed in: the create rule refuses guests) is an error, not a newer row.
      if (response.status === 400 && (await isDuplicateId(response))) {
        return 'kept-newer';
      }
      await readJson(response);
      return 'saved';
    },
  };
}

// A plain http:// address of another machine: the password and the token would travel in clear
// (release builds refuse it anyway, as an unreachable server). Allowed for `localhost` only: a
// server reached through `adb reverse` (development, end-to-end tests).
export function isInsecureServerUrl(serverUrl: string): boolean {
  return (
    /^http:\/\//i.test(serverUrl) &&
    serverHost(serverUrl).replace(/:\d+$/, '').toLowerCase() !== 'localhost'
  );
}

// The address as typed: "recipes.example.org/" -> "https://recipes.example.org".
// undefined when it isn't a web address. Parsed by hand: React Native's URL doesn't implement
// `host` and friends.
export function normalizeServerUrl(typed: string): string | undefined {
  let trimmed = typed.trim();
  while (trimmed.endsWith('/')) {
    trimmed = trimmed.slice(0, -1);
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : ['https:', '', trimmed].join('/');
  return /^[\w.-]+(?::\d{1,5})?$/.test(serverHost(withScheme)) ? withScheme : undefined;
}

// "https://recipes.example.org:8443/pb" -> "recipes.example.org:8443".
export function serverHost(serverUrl: string): string {
  const afterScheme = serverUrl.replace(/^https?:\/\//i, '');
  const slash = afterScheme.indexOf('/');
  return slash === -1 ? afterScheme : afterScheme.slice(0, slash);
}

// Signs in with an account of the server's "users" collection; returns its token.
export async function signIn(
  options: Readonly<{ email: string; fetch?: Fetch; password: string; serverUrl: string }>,
): Promise<string> {
  const response = await request(
    options.fetch ?? fetch,
    apiUrl(options.serverUrl, 'collections', 'users', 'auth-with-password'),
    {
      body: JSON.stringify({ identity: options.email.trim(), password: options.password }),
      method: 'POST',
    },
  );
  // PocketBase answers 400 to a wrong email or password.
  if (response.status === 400) {
    throw new SyncError('unauthorized', 'Wrong email or password');
  }
  return readToken(await readJson(response));
}

// serverUrl/api/…segments
function apiUrl(serverUrl: string, ...segmentList: string[]): string {
  return [serverUrl, 'api', ...segmentList].join('/');
}

// A create refused because a record with this id exists.
async function isDuplicateId(response: Response): Promise<boolean> {
  try {
    const body = (await response.clone().json()) as { data?: { id?: { code?: unknown } } };
    return body.data?.id?.code === 'validation_not_unique';
  } catch {
    return false;
  }
}

// The filter of a pull page (PocketBase's syntax). The values are quoted strings: quotes are
// removed from them (times and ids never contain any).
function pullFilter(position: PullPosition): string | undefined {
  const quoted = (value: string) => `'${value.replaceAll("'", '')}'`;
  if ('since' in position) {
    // >=: rows written in the same millisecond as the last one pulled aren't missed.
    return position.since ? ['updated', '>=', quoted(position.since)].join(' ') : undefined;
  }
  const updated = quoted(position.after.updated);
  return [
    '(updated >',
    updated,
    '|| (updated =',
    updated,
    '&& id >',
    quoted(position.after.id),
    '))',
  ].join(' ');
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 401 || response.status === 403) {
    throw new SyncError('unauthorized', `Refused by the server (${response.status})`);
  }
  if (!response.ok) {
    throw new SyncError('failed', `The server answered ${response.status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new SyncError('failed', 'The server answered something that is not JSON');
  }
}

async function readServerInfo(response: Response): Promise<ServerInfo> {
  const { migrations, minimumAppSyncVersion } = (await readJson(response)) as Partial<
    Record<keyof ServerInfo, unknown>
  >;
  if (typeof minimumAppSyncVersion !== 'number' || !Array.isArray(migrations)) {
    throw new SyncError('failed', 'Unexpected server info');
  }
  return {
    migrations: migrations.filter((file): file is string => typeof file === 'string'),
    minimumAppSyncVersion,
  };
}

function readToken(body: unknown): string {
  const { token } = body as { token?: unknown };
  if (typeof token !== 'string' || !token) {
    throw new SyncError('failed', 'The server sent no sign-in token');
  }
  return token;
}

async function request(fetchFunction: Fetch, url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchFunction(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: controller.signal,
    });
  } catch (error) {
    throw new SyncError(
      'unreachable',
      `No answer from the server: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}
