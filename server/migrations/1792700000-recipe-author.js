/// <reference path="../pb_data/types.d.ts" />
/* global migrate, RelationField */
// PocketBase migration: who added each recipe (see docs/sync.md › How it works). `created_by` is the
// account that created it, set by the server (server/hooks/recipe-author.pb.js), never by the app.
// The recipes from before go to the oldest account: until now, every phone shared it.

migrate(
  (app) => {
    const recipes = app.findCollectionByNameOrId('recipes');
    const users = app.findCollectionByNameOrId('users');
    recipes.fields.add(
      new RelationField({
        // Deleting an account keeps its recipes, without an author.
        cascadeDelete: false,
        collectionId: users.id,
        maxSelect: 1,
        name: 'created_by',
      }),
    );
    app.save(recipes);

    const oldestList = app.findRecordsByFilter('users', '', '+created,+id', 1, 0);
    if (oldestList.length === 0) {
      return;
    }
    // In SQL: saving each record would run its validation, and one invalid old row would stop the
    // migration. `updated` moves so the phones pull the author; `modified` doesn't, so no change made
    // on a phone meanwhile is lost (the phones take the author of a row they already have).
    app
      .db()
      .newQuery(
        [
          'UPDATE recipes',
          "SET created_by = {:author}, updated = strftime('%Y-%m-%d %H:%M:%fZ', 'now')",
          "WHERE created_by = ''",
        ].join(' '),
      )
      .bind({ author: oldestList[0].id })
      .execute();
  },
  (app) => {
    const recipes = app.findCollectionByNameOrId('recipes');
    recipes.fields.removeByName('created_by');
    app.save(recipes);
  },
);
