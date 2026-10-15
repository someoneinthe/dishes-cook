// What this app version and the sync server check about each other before each sync (see
// docs/sync.md › Versions). The server says which migrations it has applied and which oldest app
// it accepts (server/hooks/server-info.pb.js).

// The server migrations (server/migrations) this app version knows, oldest first: a test keeps the
// list equal to the folder. The server must have applied the last one, or it lacks what the app
// sends and reads.
export const SERVER_MIGRATION_LIST: readonly string[] = ['1792000000-dishes-cook-sync.js'];

// This app's sync version. Raised together with the server's minimum (MINIMUM_APP_SYNC_VERSION in
// the hook) when a server change breaks older apps: they're then asked to update.
export const SYNC_VERSION = 1;

export type ServerInfo = Readonly<{
  // Migration files the server has applied, PocketBase's own included.
  migrations: readonly string[];
  minimumAppSyncVersion: number;
}>;

export type ServerVersionCheck =
  // This app is older than the server accepts: update the app.
  | 'app-outdated'
  // Both match.
  | 'compatible'
  // The server has changes this app doesn't know (additive: it still syncs): an app update exists.
  | 'newer-server'
  // The server lacks a migration this app needs: update the server.
  | 'server-outdated';

// Our migrations are named "<10-digit timestamp>-<name>.js" (a hyphen); PocketBase's own end in
// ".go". Files named "<timestamp>_<name>.js" (an underscore) are left out on purpose: PocketBase
// writes them itself when someone edits a collection in its admin UI (automigrate), and they don't
// mean a newer app exists.
const APP_MIGRATION = /^\d{10}-[\w-]+\.js$/;

export function checkServerVersion(info: ServerInfo | undefined): ServerVersionCheck {
  const required = SERVER_MIGRATION_LIST.at(-1);
  // No info (an older server without the hook), or the last migration this app needs is missing.
  if (!info || (required !== undefined && !info.migrations.includes(required))) {
    return 'server-outdated';
  }
  if (info.minimumAppSyncVersion > SYNC_VERSION) {
    return 'app-outdated';
  }
  const isNewer = info.migrations.some(
    (file) => APP_MIGRATION.test(file) && !SERVER_MIGRATION_LIST.includes(file),
  );
  return isNewer ? 'newer-server' : 'compatible';
}
