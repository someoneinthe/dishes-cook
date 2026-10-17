/// <reference path="../pb_data/types.d.ts" />
/* global Collection, migrate */
// PocketBase migration: the meal history (see docs/sync.md), one record each time a recipe is
// cooked: `recipe` is the recipe's sync id, `cooked_at` the time it was cooked (ms). Records are
// only added and marked deleted, never edited, with the same rules as the other synced
// collections (1792000000-dishes-cook-sync.js).

const SIGNED_IN = '@request.auth.id != "" && @request.auth.collectionName = "users"';
const NOT_OLDER = `${SIGNED_IN} && @request.body.modified >= modified`;

migrate(
  (app) => {
    app.save(
      new Collection({
        createRule: SIGNED_IN,
        // Rows are never deleted: `deleted` (a time, 0 = alive) tells the other phones.
        deleteRule: null,
        fields: [
          // The recipe's sync id: 15 characters of [0-9a-f].
          {
            max: 15,
            min: 15,
            name: 'recipe',
            pattern: '^[0-9a-f]+$',
            required: true,
            type: 'text',
          },
          { min: 0, name: 'cooked_at', onlyInt: true, type: 'number' },
          { min: 0, name: 'modified', onlyInt: true, type: 'number' },
          { min: 0, name: 'deleted', onlyInt: true, type: 'number' },
          { name: 'created', onCreate: true, onUpdate: false, type: 'autodate' },
          // The phones pull the rows updated since their last pull, in this order.
          { name: 'updated', onCreate: true, onUpdate: true, type: 'autodate' },
        ],
        indexes: ['CREATE INDEX idx_cooked_meals_updated ON cooked_meals (updated, id)'],
        listRule: SIGNED_IN,
        name: 'cooked_meals',
        type: 'base',
        updateRule: NOT_OLDER,
        viewRule: SIGNED_IN,
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('cooked_meals'));
  },
);
