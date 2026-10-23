/// <reference path="../pb_data/types.d.ts" />
/* global migrate */
// PocketBase migration: the phones read the accounts' names, to show who added a recipe (see
// docs/sync.md › How it works). Every signed-in account can list the others; their emails stay
// hidden (PocketBase shows another account's email only when its `emailVisibility` is on).

const SIGNED_IN = '@request.auth.id != "" && @request.auth.collectionName = "users"';
// PocketBase's default: each account sees itself only.
const ITSELF = 'id = @request.auth.id';

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = SIGNED_IN;
    users.viewRule = SIGNED_IN;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = ITSELF;
    users.viewRule = ITSELF;
    app.save(users);
  },
);
