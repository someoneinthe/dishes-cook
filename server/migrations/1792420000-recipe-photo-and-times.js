/// <reference path="../pb_data/types.d.ts" />
/* global FileField, migrate, NumberField */
// PocketBase migration: a recipe's preparation and cooking times (minutes), and its photo (see
// docs/sync.md). The photo is a protected file: only the phones signed in (the collection's view
// rule) can download it, with a short-lived file token. JPEG only, as the app saves it (about
// 1280 px, a few hundred KB); 5 MB at most.

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

migrate(
  (app) => {
    const recipes = app.findCollectionByNameOrId('recipes');
    recipes.fields.add(new NumberField({ min: 0, name: 'prep_minutes', onlyInt: true }));
    recipes.fields.add(new NumberField({ min: 0, name: 'cook_minutes', onlyInt: true }));
    recipes.fields.add(
      new FileField({
        maxSelect: 1,
        maxSize: MAX_PHOTO_SIZE,
        mimeTypes: ['image/jpeg'],
        name: 'photo',
        protected: true,
      }),
    );
    app.save(recipes);
  },
  (app) => {
    const recipes = app.findCollectionByNameOrId('recipes');
    for (const name of ['prep_minutes', 'cook_minutes', 'photo']) {
      recipes.fields.removeByName(name);
    }
    app.save(recipes);
  },
);
