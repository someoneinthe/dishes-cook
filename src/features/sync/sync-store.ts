import { deleteItemAsync, getItem, setItem } from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import type { AppDatabase } from '@/db/types';
import type { SyncErrorKind } from './sync-api';
import type { SyncCursors } from './sync-engine';
import { checkServerVersion } from './server-version';
import { createSyncApi, signIn, SyncError } from './sync-api';
import { INITIAL_CURSORS, synchronize } from './sync-engine';

// The sync server the phone is connected to, and how the last sync went. Without a server, the
// recipes stay on the phone only. The address, email and sync progress are kept in expo-sqlite's
// key-value store; the sign-in token (never the password) in expo-secure-store.

export type SyncState = Readonly<{
  // undefined: not connected (the phone's data only).
  connection?: Readonly<{ email: string; serverUrl: string }>;
  // Why the last sync failed; undefined after a successful one.
  error?: SyncErrorKind;
  // The server has changes this app version doesn't know (it still syncs): an app update exists.
  isAppUpdateAvailable: boolean;
  isSyncing: boolean;
  lastSyncedAt?: number;
}>;

type StoredSync = Readonly<{
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
} = {
  isAppUpdateAvailable: false,
  isSyncing: false,
};
const listenerSet = new Set<() => void>();
// The sync running now: callers wait for it instead of starting another.
const running: { promise?: Promise<void> } = {};

// Signs in, saves the server, then syncs: the phone's recipes and the server's are merged.
// Throws a SyncError when signing in fails (nothing is saved then).
export async function connect(
  database: AppDatabase,
  options: Readonly<{ email: string; password: string; serverUrl: string }>,
): Promise<void> {
  const token = await signIn(options);
  setItem(TOKEN_KEY, token);
  write({
    cursors: INITIAL_CURSORS,
    email: options.email.trim(),
    serverUrl: options.serverUrl,
  });
  state.error = undefined;
  publish();
  await syncNow(database);
}

// Back to the phone's data only. The recipes stay on the phone, and on the server.
export async function disconnect(): Promise<void> {
  Storage.removeItemSync(STORAGE_KEY);
  await deleteItemAsync(TOKEN_KEY);
  state.error = undefined;
  state.isAppUpdateAvailable = false;
  publish();
}

export function getSyncState(): SyncState {
  state.current ??= toState(read());
  return state.current;
}

// Pulls the server's changes and pushes the phone's. Does nothing when not connected; never
// throws (the error is kept in the state). A call during a sync waits for that one.
export async function syncNow(database: AppDatabase): Promise<void> {
  running.promise ??= runSyncOnce(database);
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
      cursors: {
        pulledUntil:
          typeof parsed.cursors?.pulledUntil === 'string' ? parsed.cursors.pulledUntil : '',
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

async function runSync(database: AppDatabase): Promise<void> {
  const stored = read();
  const token = getItem(TOKEN_KEY);
  if (!stored || !token) {
    return;
  }
  state.isSyncing = true;
  publish();
  try {
    // Renewed first, on every sync: the server treats a refused token as a guest, whose reads
    // come back empty instead of failing. Renewing it fails clearly (and keeps it valid a year).
    const currentToken = await createSyncApi({ serverUrl: stored.serverUrl, token }).refreshToken();
    setItem(TOKEN_KEY, currentToken);
    const api = createSyncApi({ serverUrl: stored.serverUrl, token: currentToken });
    // Before any change: a server too old (or an app too old) for the other isn't synced with.
    const versionCheck = checkServerVersion(await api.getServerInfo());
    if (versionCheck === 'server-outdated' || versionCheck === 'app-outdated') {
      throw new SyncError(versionCheck, `Versions don't match: ${versionCheck}`);
    }
    state.isAppUpdateAvailable = versionCheck === 'newer-server';
    const cursors = await synchronize(database, api, stored.cursors);
    // Disconnected while syncing: nothing to save.
    if (read()) {
      write({ ...stored, cursors, lastSyncedAt: Date.now() });
    }
    state.error = undefined;
  } catch (error) {
    state.error = error instanceof SyncError ? error.kind : 'failed';
    if (!(error instanceof SyncError)) {
      console.error('Sync failed', error);
    }
  } finally {
    state.isSyncing = false;
    publish();
  }
}

async function runSyncOnce(database: AppDatabase): Promise<void> {
  try {
    await runSync(database);
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
    connection: stored ? { email: stored.email, serverUrl: stored.serverUrl } : undefined,
    error: stored ? state.error : undefined,
    isAppUpdateAvailable: stored ? state.isAppUpdateAvailable : false,
    isSyncing: state.isSyncing,
    lastSyncedAt: stored?.lastSyncedAt,
  };
}

function write(stored: StoredSync): void {
  Storage.setItemSync(STORAGE_KEY, JSON.stringify(stored));
}
