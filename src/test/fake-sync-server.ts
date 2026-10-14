// An in-memory stand-in for the sync server's HTTP API (PocketBase), for sync tests: the calls the
// app makes, with the behaviours measured on a real server (see server/migrations):
// - a refused or missing token is a guest: lists come back empty, creates get a 400, updates a 404;
// - an update older than the stored row (`modified`) is refused with a 404 (the update rule);
// - a create with an existing id gets a 400 `validation_not_unique`.

export type FakeSyncServer = Readonly<{
  // Every row of a collection, as stored (tests read and edit them).
  collection: (name: string) => Map<string, StoredRow>;
  fetch: typeof fetch;
  // Requests from now on fail as if the server were unreachable (or answer again).
  setReachable: (isReachable: boolean) => void;
}>;

type StoredRow = Record<string, unknown> & { id: string; modified: number; updated: string };

const PER_PAGE_MAX = 500;

export function createFakeSyncServer(
  account: Readonly<{ email: string; password: string }>,
): FakeSyncServer {
  const collectionMap = new Map<string, Map<string, StoredRow>>();
  const tokenSet = new Set<string>();
  let tokenCount = 0;
  let clock = 0;
  let isReachable = true;

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
    const updated = { ...stored, ...request.body, id, updated: now() } as StoredRow;
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
    const created = { deleted: 0, modified: 0, ...request.body, id, updated: now() } as StoredRow;
    rowMap.set(id, created);
    return json(200, created);
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
      return json(200, { items: request.isSignedIn ? listPage(rowMap, request.query) : [] });
    }
    return request.method === 'POST' ? createRecord(rowMap, request) : undefined;
  };

  const fakeFetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!isReachable) {
      return Promise.reject(new TypeError('Network request failed'));
    }
    const url = new URL(input instanceof Request ? input.url : input);
    const request: FakeRequest = {
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {},
      isSignedIn: tokenSet.has(new Headers(init.headers).get('Authorization') ?? ''),
      method: init.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
    };
    return Promise.resolve(
      handleAuth(request) ?? handleRecords(request) ?? json(404, { message: 'Not found' }),
    );
  }) as typeof fetch;

  return {
    collection,
    fetch: fakeFetch,
    setReachable: (value) => {
      isReachable = value;
    },
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

// filter=updated >= '…', sort=updated,id, page, perPage: what the app asks for.
function listPage(rowMap: Map<string, StoredRow>, query: URLSearchParams): StoredRow[] {
  const since = /^updated >= '(.*)'$/.exec(query.get('filter') ?? '')?.[1] ?? '';
  const perPage = Math.min(Number(query.get('perPage') ?? 30), PER_PAGE_MAX);
  const page = Number(query.get('page') ?? 1);
  return [...rowMap.values()]
    .filter((row) => row.updated >= since)
    .toSorted((a, b) => a.updated.localeCompare(b.updated) || a.id.localeCompare(b.id))
    .slice((page - 1) * perPage, page * perPage);
}
