/// <reference path="../pb_data/types.d.ts" />
/* global JSONField, migrate */
// PocketBase migration: the quantities of a recipe's ingredients (see docs/sync.md), next to its
// `ingredients` list: { "<ingredient sync id>": { "amount": 1.5, "unit": "kg" } } (no unit: pieces).
// A separate field: apps without quantities keep reading `ingredients` as before.

migrate(
  (app) => {
    const recipes = app.findCollectionByNameOrId('recipes');
    recipes.fields.add(new JSONField({ maxSize: 100_000, name: 'quantities' }));
    app.save(recipes);
  },
  (app) => {
    const recipes = app.findCollectionByNameOrId('recipes');
    recipes.fields.removeByName('quantities');
    app.save(recipes);
  },
);
