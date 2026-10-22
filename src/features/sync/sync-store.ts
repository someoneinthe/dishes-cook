import { deleteItemAsync, getItem, setItem } from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import type { SyncedTable } from '@/db/schema';
import type { AppDatabase, DatabaseConnection } from '@/db/types';
import { recipePhotoStore } from '@/features/recipes/recipe-photos';
import type { SyncErrorKind } from './sync-api';
import type { SyncCursors } from './sync-engine';
import { checkServerVersion } from './server-version';
import { createSyncApi, signIn, SyncError } from './sync-api';
import { countPendingChanges, INITIAL_CURSORS, synchronize } from './sync-engine';

// The sync server the phone is connected to, and how the last sync went. Without a server, the
// recipes stay on the phone only. The address, email, account id and sync progress are kept in
// expo-sqlite's key-value store; the sign-in token (never the password) in expo-secure-store.

export type SyncState = Readonly<{
  // undefined: not connected (the phone's data only). `accountId`: the account signed in to (the
  // author of the recipes this phone adds), undefined until the first sync of a phone connected
  // before it was kept.
  connection?: Readonly<{ accountId?: string; email: string; serverUrl: string }>;
  // Why the last sync failed; undefined after a successful one.
  error?: SyncErrorKind;
  // The server has changes this app version doesn't know (it still syncs): an app update exists.
  isAppUpdateAvailable: boolean;
  isSyncing: boolean;
  lastSyncedAt?: number;
}>;

type StoredSync = Readonly<{
  accountId?: string;
  cursors: SyncCursors;
  email: string;
  lastSyncedAt?: number;
  serverUrl: string;
}>;

const STORAGE_KEY = 'sync';
const TOKEN_KEY = 'sync-token';

const state: {
  current?: SyncState;
  error?: SyncErrorKind;
  isAppUpdateAvailable: boolean;
  isSyncing: boolean;
  // Changes on each connect and disconnect: a sync started before stops at its next request and
  // keeps nothing (token, progress, error), so it can't bring back the server it was syncing with.
  session: number;
} = {
  isAppUpdateAvailable: false,
  isSyncing: false,
  session: 0,
};
const listenerSet = new Set<() => void>();
// The sync running now, and the session it belongs to: callers wait for it instead of starting
// another, unless its session is over.
const running: { promise?: Promise<void>; session?: number } = {};

// Signs in, saves the server, then syncs: the phone's recipes and the server's are merged.
// Throws a SyncError when signing in fails (nothing is saved then). Saves nothing either when
// another connect or a disconnect came while signing in: the latest one wins.
export async function connect(
  connection: DatabaseConnection,
  options: Readonly<{ email: string; password: string; serverUrl: string }>,
): Promise<void> {
  state.session += 1;
  const session = state.session;
  const { accountId, token } = await signIn(options);
  if (state.session !== session) {
    return;
  }
  setItem(TOKEN_KEY, token);
  write({
    accountId,
    cursors: INITIAL_CURSORS,
    email: options.email.trim(),
    serverUrl: options.serverUrl,
  });
  state.error = undefined;
  publish();
  await syncNow(connection);
}

// Back to the phone's data only. The recipes stay on the phone, and on the server.
export async function disconnect(): Promise<void> {
  state.session += 1;
  Storage.removeItemSync(STORAGE_KEY);
  await deleteItemAsync(TOKEN_KEY);
  state.error = undefined;
  state.isAppUpdateAvailable = false;
  publish();
}

// How many changes wait on the phone for the next sync; 0 when not connected.
export function getPendingChangeCount(database: AppDatabase): number {
  const stored = read();
  return stored ? countPendingChanges(database, stored.cursors.pushedFrom) : 0;
}

export function getSyncState(): SyncState {
  state.current ??= toState(read());
  return state.current;
}

// Pulls the server's changes and pushes the phone's. Does nothing when not connected; never
// throws (the error is kept in the state). A call during a sync waits for that one.
export async function syncNow(connection: DatabaseConnection): Promise<void> {
  if (running.promise && running.session !== state.session) {
    // Started before a connect or disconnect: it stops at its next request.
    await running.promise;
  }
  if (!running.promise) {
    running.session = state.session;
    running.promise = runSyncOnce(connection);
  }
  await running.promise;
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, getSyncState);
}

function publish(): void {
  state.current = toState(read());
  for (const listener of listenerSet) {
    listener();
  }
}

function read(): StoredSync | undefined {
  const stored = Storage.getItemSync(STORAGE_KEY);
  if (!stored) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(stored) as Partial<StoredSync>;
    if (typeof parsed.serverUrl !== 'string' || typeof parsed.email !== 'string') {
      return undefined;
    }
    return {
      accountId: typeof parsed.accountId === 'string' ? parsed.accountId : undefined,
      cursors: {
        pulledUntil: readPulledUntil(parsed.cursors?.pulledUntil),
        pushedFrom: typeof parsed.cursors?.pushedFrom === 'number' ? parsed.cursors.pushedFrom : 0,
      },
      email: parsed.email,
      lastSyncedAt: typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : undefined,
      serverUrl: parsed.serverUrl,
    };
  } catch {
    // Unreadable (e.g. written by a future version): not connected.
    return undefined;
  }
}

// The pull cursors as stored. Before one per table, a single time was kept for both, which could
// skip rows (ingredients written while recipes were pulled): everything is pulled again once,
// which only brings what's missing here. A table added since (the meal history) is pulled from
// the start.
function readPulledUntil(value: unknown): SyncCursors['pulledUntil'] {
  const cursors =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const cursorOf = (table: SyncedTable) => {
    const cursor = cursors[table];
    return typeof cursor === 'string' ? cursor : '';
  };
  return {
    cooked_meals: cursorOf('cooked_meals'),
    ingredients: cursorOf('ingredients'),
    recipes: cursorOf('recipes'),
  };
}

async function runSync(connection: DatabaseConnection): Promise<void> {
  const stored = read();
  if (!stored) {
    return;
  }
  const token = getItem(TOKEN_KEY);
  if (!token) {
    // Connected without a token: the phone was restored from a backup, which keeps the server's
    // address but not the token (encrypted with a key that stays on the old phone).
    state.error = 'unauthorized';
    publish();
    return;
  }
  const session = state.session;
  const isCurrent = () => state.session === session;
  // Requests of a session that's over fail: the sync stops there.
  const fetchInSession: typeof fetch = (input, init) =>
    isCurrent() ? fetch(input, init) : Promise.reject(new Error('Disconnected'));
  state.isSyncing = true;
  publish();
  try {
    // Renewed first, on every sync: the server treats a refused token as a guest, whose reads
    // come back empty instead of failing. Renewing it fails clearly (and keeps it valid a year).
    const { accountId, token: currentToken } = await createSyncApi({
      fetch: fetchInSession,
      serverUrl: stored.serverUrl,
      token,
    }).refreshToken();
    if (!isCurrent()) {
      return;
    }
    setItem(TOKEN_KEY, currentToken);
    if (accountId !== stored.accountId) {
      // Connected before the account id was kept: the Mine filter can tell the phone's recipes now.
      write({ ...stored, accountId });
      publish();
    }
    const api = createSyncApi({
      fetch: fetchInSession,
      serverUrl: stored.serverUrl,
      token: currentToken,
    });
    // Before any change: a server too old (or an app too old) for the other isn't synced with.
    const versionCheck = checkServerVersion(await api.getServerInfo());
    if (versionCheck === 'server-outdated' || versionCheck === 'app-outdated') {
      throw new SyncError(versionCheck, `Versions don't match: ${versionCheck}`);
    }
    state.isAppUpdateAvailable = versionCheck === 'newer-server';
    const cursors = await synchronize(connection.db, api, stored.cursors, {
      holdChanges: connection.holdSyncChanges,
      photos: recipePhotoStore,
    });
    // Disconnected (or connected again) while syncing: nothing to save.
    if (!isCurrent()) {
      return;
    }
    write({ ...stored, accountId, cursors, lastSyncedAt: Date.now() });
    state.error = undefined;
  } catch (error) {
    if (!isCurrent()) {
      return;
    }
    state.error = error instanceof SyncError ? error.kind : 'failed';
    if (!(error instanceof SyncError)) {
      console.error('Sync failed', error);
    }
  } finally {
    // What it pulled, even if it failed later: screens refresh once.
    connection.releaseSyncChanges();
    state.isSyncing = false;
    publish();
  }
}

async function runSyncOnce(connection: DatabaseConnection): Promise<void> {
  try {
    await runSync(connection);
  } finally {
    running.promise = undefined;
  }
}

function subscribe(listener: () => void) {
  listenerSet.add(listener);
  return () => {
    listenerSet.delete(listener);
  };
}

function toState(stored: StoredSync | undefined): SyncState {
  return {
    connection: stored
      ? {
          ...(stored.accountId !== undefined && { accountId: stored.accountId }),
          email: stored.email,
          serverUrl: stored.serverUrl,
        }
      : undefined,
    error: stored ? state.error : undefined,
    isAppUpdateAvailable: Boolean(stored) && state.isAppUpdateAvailable,
    isSyncing: state.isSyncing,
    lastSyncedAt: stored?.lastSyncedAt,
  };
}

function write(stored: StoredSync): void {
  Storage.setItemSync(STORAGE_KEY, JSON.stringify(stored));
}
