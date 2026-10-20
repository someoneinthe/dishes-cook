/// <reference path="../pb_data/types.d.ts" />
/* global migrate, TextField */
// PocketBase migration: a recipe is a dish or a drink (see docs/sync.md). Text, like `course`:
// empty on the recipes from before (the app reads them as dishes).

migrate(
  (app) => {
    const recipes = app.findCollectionByNameOrId('recipes');
    recipes.fields.add(new TextField({ max: 10, name: 'kind' }));
    app.save(recipes);
  },
  (app) => {
    const recipes = app.findCollectionByNameOrId('recipes');
    recipes.fields.removeByName('kind');
    app.save(recipes);
  },
);
