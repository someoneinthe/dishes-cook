/// <reference path="../pb_data/types.d.ts" />
/* global Collection, migrate */
// PocketBase migration: the collections the app syncs with (see docs/sync.md). Copy these files
// into `pb_migrations/` next to the PocketBase executable; `pocketbase serve` applies them on start.

// Signed in with an account of the "users" collection (created by the admin: no sign-up).
const SIGNED_IN = '@request.auth.id != "" && @request.auth.collectionName = "users"';

// Last write wins: an update older than the stored row is refused (the app then keeps the
// server's version). `modified` is the app's own clock, in milliseconds.
const NOT_OLDER = `${SIGNED_IN} && @request.body.modified >= modified`;

const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

function syncedCollection(name, fieldList) {
  return new Collection({
    createRule: SIGNED_IN,
    // Rows are never deleted: `deleted` (a time, 0 = alive) tells the other phones.
    deleteRule: null,
    fields: [
      ...fieldList,
      { min: 0, name: 'modified', onlyInt: true, type: 'number' },
      { min: 0, name: 'deleted', onlyInt: true, type: 'number' },
      { name: 'created', onCreate: true, onUpdate: false, type: 'autodate' },
      // The phones pull the rows updated since their last pull, in this order.
      { name: 'updated', onCreate: true, onUpdate: true, type: 'autodate' },
    ],
    indexes: [`CREATE INDEX idx_${name}_updated ON ${name} (updated, id)`],
    listRule: SIGNED_IN,
    name,
    type: 'base',
    updateRule: NOT_OLDER,
    viewRule: SIGNED_IN,
  });
}

migrate(
  (app) => {
    app.save(
      syncedCollection('ingredients', [{ max: 200, name: 'name', required: true, type: 'text' }]),
    );
    app.save(
      syncedCollection('recipes', [
        { max: 500, name: 'title', required: true, type: 'text' },
        { max: 100_000, name: 'instructions', type: 'text' },
        { max: 20, name: 'season', type: 'text' },
        { max: 20, name: 'course', type: 'text' },
        // Sync ids of the recipe's ingredients.
        { maxSize: 100_000, name: 'ingredients', type: 'json' },
      ]),
    );

    // Accounts are created by the admin, and a phone stays signed in for a year (each sync
    // renews it), so a phone away from home for a while doesn't have to sign in again.
    const users = app.findCollectionByNameOrId('users');
    users.createRule = null;
    users.authToken.duration = ONE_YEAR_IN_SECONDS;
    app.save(users);
  },
  (app) => {
    for (const name of ['recipes', 'ingredients']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
    const users = app.findCollectionByNameOrId('users');
    users.createRule = '';
    users.authToken.duration = ONE_WEEK_IN_SECONDS;
    app.save(users);
  },
);
