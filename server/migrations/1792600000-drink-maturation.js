/// <reference path="../pb_data/types.d.ts" />
/* global migrate, NumberField */
// PocketBase migration: a drink's maturation time, in months as typed (0.5, 2), up to 24 (see
// docs/sync.md). 0 (and the recipes from before) = not given, like the other times.

migrate(
  (app) => {
    const recipes = app.findCollectionByNameOrId('recipes');
    recipes.fields.add(new NumberField({ max: 24, min: 0, name: 'maturation_months' }));
    app.save(recipes);
  },
  (app) => {
    const recipes = app.findCollectionByNameOrId('recipes');
    recipes.fields.removeByName('maturation_months');
    app.save(recipes);
  },
);
