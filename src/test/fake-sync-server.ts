import type { ServerInfo } from '@/features/sync/server-version';
import { SERVER_MIGRATION_LIST, SYNC_VERSION } from '@/features/sync/server-version';
// An in-memory stand-in for the sync server's HTTP API (PocketBase), for sync tests: the calls the
// app makes, with the behaviours measured on a real server (see server/migrations):
// - a refused or missing token is a guest: lists come back empty, creates get a 400, updates a 404;
// - an update older than the stored row (`modified`) is refused with a 404 (the update rule);
// - a create with an existing id gets a 400 `validation_not_unique`.

export type FakeSyncServer = Readonly<{
  // Every row of a collection, as stored (tests read and edit them).
  collection: (name: string) => Map<string, StoredRow>;
  fetch: typeof fetch;
  // The photos stored, by file name: their content, in base64.
  fileMap: Map<string, string>;
  // Called before each list of a collection is read: tests write rows there, as another phone
  // would during a pull.
  setBeforeList: (callback: ((name: string) => void) | undefined) => void;
  // Requests from now on fail as if the server were unreachable (or answer again).
  setReachable: (isReachable: boolean) => void;
  // What /api/dishes-cook/server answers (server/hooks/server-info.pb.js); undefined = a server
  // without that hook (404). By default: up to date with this app.
  setServerInfo: (info: ServerInfo | undefined) => void;
}>;

type StoredRow = Record<string, unknown> & { id: string; modified: number; updated: string };

const PER_PAGE_MAX = 500;

export function createFakeSyncServer(
  account: Readonly<{ email: string; password: string }>,
): FakeSyncServer {
  const collectionMap = new Map<string, Map<string, StoredRow>>();
  const fileMap = new Map<string, string>();
  const fileTokenSet = new Set<string>();
  const tokenSet = new Set<string>();
  let tokenCount = 0;
  let clock = 0;
  let isReachable = true;
  let beforeList: ((name: string) => void) | undefined;
  let serverInfo: ServerInfo | undefined = {
    migrations: [...SERVER_MIGRATION_LIST],
    minimumAppSyncVersion: SYNC_VERSION,
  };

  const collection = (name: string) => {
    let rowMap = collectionMap.get(name);
    if (!rowMap) {
      rowMap = new Map();
      collectionMap.set(name, rowMap);
    }
    return rowMap;
  };
  // Server times, in the server's format, strictly increasing.
  const now = () => {
    clock += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, 0, clock)).toISOString().replace('T', ' ');
  };
  const newToken = () => {
    tokenCount += 1;
    const token = `token-${tokenCount}`;
    tokenSet.add(token);
    return token;
  };

  type FakeRequest = Readonly<{
    body: Record<string, unknown>;
    // A photo sent in a multipart body: its content, in base64.
    file?: string;
    isSignedIn: boolean;
    method: string;
    path: string;
    query: URLSearchParams;
  }>;

  const handleAuth = ({ body, isSignedIn, method, path }: FakeRequest): Response | undefined => {
    if (method === 'POST' && path === '/api/collections/users/auth-with-password') {
      const isAccount = body.identity === account.email && body.password === account.password;
      return isAccount
        ? json(200, { record: { email: account.email }, token: newToken() })
        : json(400, { message: 'Failed to authenticate.' });
    }
    const isRefresh = method === 'POST' && path === '/api/collections/users/auth-refresh';
    if (!isRefresh) {
      return undefined;
    }
    return isSignedIn ? json(200, { token: newToken() }) : json(401, { message: 'Unauthorized' });
  };

  const patchRecord = (rowMap: Map<string, StoredRow>, id: string, request: FakeRequest) => {
    const stored = rowMap.get(id);
    if (!stored || !request.isSignedIn || Number(request.body.modified) < stored.modified) {
      return json(404, { message: 'The requested resource was not found.' });
    }
    const body: Record<string, unknown> = {
      ...request.body,
      modified: Number(request.body.modified),
    };
    // A photo: stored under a new name, PocketBase's way ("photo_<random>.jpg").
    if (request.file !== undefined) {
      tokenCount += 1;
      const name = ['photo_', String(tokenCount).padStart(10, '0'), '.jpg'].join('');
      fileMap.set(name, request.file);
      body.photo = name;
    }
    const updated = { ...stored, ...body, id, updated: now() } as StoredRow;
    rowMap.set(id, updated);
    return json(200, updated);
  };

  const createRecord = (rowMap: Map<string, StoredRow>, request: FakeRequest) => {
    if (!request.isSignedIn) {
      return json(400, { data: {}, message: 'Failed to create record.' });
    }
    const id = String(request.body.id);
    if (rowMap.has(id)) {
      return json(400, { data: { id: { code: 'validation_not_unique' } } });
    }
    const time = now();
    const created = {
      deleted: 0,
      modified: 0,
      ...request.body,
      created: time,
      id,
      updated: time,
    } as StoredRow;
    rowMap.set(id, created);
    return json(200, created);
  };

  // A file token (POST /api/files/token), and a protected file read with one.
  const handleFiles = ({ isSignedIn, method, path, query }: FakeRequest) => {
    if (method === 'POST' && path === '/api/files/token') {
      if (!isSignedIn) {
        return json(401, { message: 'Unauthorized' });
      }
      tokenCount += 1;
      const token = `file-token-${tokenCount}`;
      fileTokenSet.add(token);
      return json(200, { token });
    }
    const match = /^\/api\/files\/recipes\/\w+\/([\w.]+)$/.exec(path);
    if (method !== 'GET' || !match) {
      return;
    }
    const content = fileMap.get(match[1] ?? '');
    return content !== undefined && fileTokenSet.has(query.get('token') ?? '')
      ? new Response(Buffer.from(content, 'base64'), { status: 200 })
      : json(404, { message: 'Not found' });
  };

  const handleServerInfo = ({ method, path }: FakeRequest) => {
    if (method !== 'GET' || path !== '/api/dishes-cook/server') {
      return;
    }
    return serverInfo ? json(200, serverInfo) : json(404, { message: 'Not found' });
  };

  const handleRecords = (request: FakeRequest) => {
    const match = /^\/api\/collections\/(\w+)\/records(?:\/(\w+))?$/.exec(request.path);
    if (!match) {
      return;
    }
    const [, name = '', id] = match;
    const rowMap = collection(name);
    if (id) {
      return request.method === 'PATCH' ? patchRecord(rowMap, id, request) : undefined;
    }
    if (request.method === 'GET') {
      beforeList?.(name);
      return json(200, { items: request.isSignedIn ? listPage(rowMap, request.query) : [] });
    }
    return request.method === 'POST' ? createRecord(rowMap, request) : undefined;
  };

  const fakeFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!isReachable) {
      throw new TypeError('Network request failed');
    }
    const url = new URL(input instanceof Request ? input.url : input);
    const request: FakeRequest = {
      ...(await readBody(init.body)),
      isSignedIn: tokenSet.has(new Headers(init.headers).get('Authorization') ?? ''),
      method: init.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
    };
    return (
      handleAuth(request) ??
      handleFiles(request) ??
      handleServerInfo(request) ??
      handleRecords(request) ??
      json(404, { message: 'Not found' })
    );
  }) as typeof fetch;

  return {
    collection,
    fetch: fakeFetch,
    fileMap,
    setBeforeList: (callback) => {
      beforeList = callback;
    },
    setReachable: (value) => {
      isReachable = value;
    },
    setServerInfo: (info) => {
      serverInfo = info;
    },
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

// What the app asks for: sort=updated,id, perPage, page (1 by default), and a filter, either
// `updated >= '<time>'` or `(updated > '<time>' || (updated = '<time>' && id > '<id>' ))`.
function listPage(rowMap: Map<string, StoredRow>, query: URLSearchParams): StoredRow[] {
  const filter = query.get('filter') ?? '';
  const since = /^updated >= '([^']*)'$/.exec(filter)?.[1];
  const after = /^\(updated > '([^']*)' \|\| \(updated = '\1' && id > '([^']*)' \)\)$/.exec(filter);
  const isListed = (row: StoredRow) => {
    if (after) {
      const [, updated = '', id = ''] = after;
      return row.updated > updated || (row.updated === updated && row.id > id);
    }
    return row.updated >= (since ?? '');
  };
  const perPage = Math.min(Number(query.get('perPage') ?? 30), PER_PAGE_MAX);
  const page = Number(query.get('page') ?? 1);
  return [...rowMap.values()]
    .filter((row) => isListed(row))
    .toSorted((a, b) => a.updated.localeCompare(b.updated) || a.id.localeCompare(b.id))
    .slice((page - 1) * perPage, page * perPage);
}

// A request's fields, and its photo's content (a multipart body). Blobs only: React Native's
// { uri } files don't exist in Node.
async function readBody(
  body: RequestInit['body'],
): Promise<Readonly<{ body: Record<string, unknown>; file?: string }>> {
  if (typeof body === 'string') {
    return { body: JSON.parse(body) as Record<string, unknown> };
  }
  if (!(body instanceof FormData)) {
    return { body: {} };
  }
  const photo = body.get('photo');
  const payload = body.get('@jsonPayload');
  return {
    body: typeof payload === 'string' ? (JSON.parse(payload) as Record<string, unknown>) : {},
    ...(photo instanceof Blob && {
      file: Buffer.from(await photo.arrayBuffer()).toString('base64'),
    }),
  };
}
