/// <reference path="../pb_data/types.d.ts" />
/* global $app, arrayOf, DynamicModel, routerAdd */
// PocketBase hook: what the app checks before each sync (see docs/sync.md › Versions). Copy it into
// `pb_hooks/` next to the PocketBase executable (`npm run server:deploy` does).

// GET /api/dishes-cook/server, public (nothing secret in it):
// - migrations: the app's migration files (server/migrations) this server has applied. An app needs
//   the last server migration it knows; one it doesn't know means a newer app version exists.
//   PocketBase's own migrations are left out: they would tell anyone its exact version.
// - minimumAppSyncVersion: older apps (SYNC_VERSION in src/features/sync/server-version.ts) are
//   asked to update instead of syncing. Raise it only for a server change that breaks older apps.
routerAdd('GET', '/api/dishes-cook/server', (event) => {
  // Inside the handler: PocketBase runs each handler in its own context, without this file's scope.
  const MINIMUM_APP_SYNC_VERSION = 1;
  // "<10-digit timestamp>-<name>.js" (APP_MIGRATION in src/features/sync/server-version.ts).
  const APP_MIGRATION = /^\d{10}-[\w-]+\.js$/;
  const rowList = arrayOf(new DynamicModel({ file: '' }));
  $app.db().select('file').from('_migrations').all(rowList);
  return event.json(200, {
    migrations: rowList.map((row) => row.file).filter((file) => APP_MIGRATION.test(file)),
    minimumAppSyncVersion: MINIMUM_APP_SYNC_VERSION,
  });
});
