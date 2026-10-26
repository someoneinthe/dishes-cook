/// <reference path="../pb_data/types.d.ts" />
/* global migrate */
// PocketBase migration: an update at the stored version (same `modified`) may no longer change the
// row's content (see docs/sync.md › How it works). Before, the update rule let any update of the
// same version through: a phone re-sending a row it had pulled, with something missing (an older
// app dropped a pulled recipe's ingredient it had under the same name), overwrote the other phones'
// version without a newer change. A new version still wins; the same version goes through only
// unchanged (an app sending again what the server has), or with just the recipe's photo, which the
// app uploads onto the version it just pushed (a request of its own).

const SIGNED_IN = '@request.auth.id != "" && @request.auth.collectionName = "users"';
const NOT_OLDER = `${SIGNED_IN} && @request.body.modified >= modified`;

// The fields a phone sends, by collection; `photo` is left out on purpose (see above).
const CONTENT_FIELDS = {
  cooked_meals: ['recipe', 'cooked_at', 'deleted'],
  ingredients: ['name', 'deleted'],
  recipes: [
    'title',
    'instructions',
    'season',
    'course',
    'ingredients',
    'quantities',
    'kind',
    'prep_minutes',
    'cook_minutes',
    'maturation_months',
    'deleted',
  ],
};

// `:changed` is true only for a field the request sends with another value than the stored one.
function newerOrUnchanged(fieldList) {
  const unchanged = fieldList.map((field) => `@request.body.${field}:changed = false`).join(' && ');
  return `${SIGNED_IN} && (@request.body.modified > modified || (@request.body.modified = modified && ${unchanged}))`;
}

migrate(
  (app) => {
    for (const [name, fieldList] of Object.entries(CONTENT_FIELDS)) {
      const collection = app.findCollectionByNameOrId(name);
      collection.updateRule = newerOrUnchanged(fieldList);
      app.save(collection);
    }
  },
  (app) => {
    for (const name of Object.keys(CONTENT_FIELDS)) {
      const collection = app.findCollectionByNameOrId(name);
      collection.updateRule = NOT_OLDER;
      app.save(collection);
    }
  },
);
