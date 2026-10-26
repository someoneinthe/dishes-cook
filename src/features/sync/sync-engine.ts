import { and, count, gte, isNotNull, lt, lte, sql } from 'drizzle-orm';
import type { SyncedTable } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { cookedMeals, ingredients, recipes, syncDeletions } from '@/db/schema';
import type { ServerCookedMeal, ServerRecipe, SyncApi } from './sync-api';
import type { PhotoStore } from './sync-photos';
import type { PulledDeletions } from './sync-pull';
import type { SyncedTableSchema } from './sync-shared';
import { downloadPhotos, PHOTO_TO_PUSH, pushPhotos } from './sync-photos';
import {
  applyCookedMeals,
  applyIngredients,
  applyRecipes,
  pull,
  pullAccounts,
  settleDeletedIngredients,
} from './sync-pull';
import { pushCookedMeals, pushDeletions, pushIngredients, pushRecipes } from './sync-push';
import { earliest, latest, notOnServer } from './sync-shared';

// Two-way sync between the phone's database and the sync server (see docs/sync.md):
// 1. pull the rows written on the server since the last pull, and apply the newer ones (ingredients,
//    then recipes, then the meal history: each links to the previous), and the accounts' names;
// 2. push the deletions, then the rows the server doesn't have in this version.
// The newest change of a row wins (`updated_at` here, `modified` there). Each row also keeps the
// version the server has (`server_version`): a pulled row gets it, as does a pushed row the server
// saved, so a sync never sends back what it just pulled.

export type SyncCursors = Readonly<{
  // Server time of the last row pulled, per table ('' = never pulled: everything). One per table:
  // a recipe pulled later than an ingredient written meanwhile mustn't move the ingredients past it.
  pulledUntil: Readonly<Record<SyncedTable, string>>;
  // Before server versions, what was pushed: the rows changed here before this time (ms). Read
  // once, to set the server versions of a phone that synced with an older app ('legacy').
  pushedFrom: number;
  // Whether the rows' `server_version` describe this server: 'kept' once they do; 'reset' when
  // connecting (another server, or the same one again: everything is pushed once, and merged);
  // 'legacy' for a phone that synced before server versions.
  serverVersions: 'kept' | 'legacy' | 'reset';
}>;

export const INITIAL_CURSORS: SyncCursors = {
  pulledUntil: { cooked_meals: '', ingredients: '', recipes: '' },
  pushedFrom: 0,
  serverVersions: 'reset',
};

// How many changes wait for the next sync: the deletions, and the rows the server doesn't have in
// this version, counted in SQL. Before the first sync with server versions ('legacy'), the rows
// changed since the last push, but those dated after `now`: they were pulled from a phone whose
// clock is ahead, not changed here.
export function countPendingChanges(
  database: AppDatabase,
  cursors: Pick<SyncCursors, 'pushedFrom' | 'serverVersions'>,
  now: number = Date.now(),
): number {
  // After connecting, every row is pushed.
  const changedWhere = (table: SyncedTableSchema) => {
    if (cursors.serverVersions === 'legacy') {
      return and(gte(table.updatedAt, cursors.pushedFrom), lte(table.updatedAt, now));
    }
    return cursors.serverVersions === 'reset' ? undefined : notOnServer(table);
  };
  const countChanged = (table: SyncedTableSchema) =>
    database.select({ count: count() }).from(table).where(changedWhere(table)).get()?.count ?? 0;
  const deletionCount = database.select({ count: count() }).from(syncDeletions).get()?.count ?? 0;
  const photoCount =
    database.select({ count: count() }).from(recipes).where(PHOTO_TO_PUSH).get()?.count ?? 0;
  return (
    deletionCount +
    countChanged(ingredients) +
    countChanged(recipes) +
    countChanged(cookedMeals) +
    photoCount
  );
}

// `holdChanges` runs each batch of writes (see DatabaseConnection.holdSyncChanges): screens refresh
// once the sync is over rather than after each page.
export async function synchronize(
  database: AppDatabase,
  api: SyncApi,
  cursors: SyncCursors,
  options: Readonly<{
    holdChanges?: (write: () => void) => void;
    now?: () => number;
    // Recipe photos' files; without it, photos aren't synced (tests of the rest).
    photos?: PhotoStore;
  }> = {},
): Promise<SyncCursors> {
  const { holdChanges = (write: () => void) => write(), now = Date.now, photos } = options;
  const startedAt = now();
  holdChanges(() => {
    prepareServerVersions(database, cursors);
  });
  // Ingredients deleted on another phone that a recipe here still uses, or whose recipes link ours
  // of the same name: decided once the recipes are pulled too (their deletions may come with them).
  const deletions: PulledDeletions = { aliasSyncIds: new Set(), usedIds: new Set() };
  const pullIngredients = (since: string) =>
    pull(api, 'ingredients', since, (rowList) => {
      holdChanges(() => {
        applyIngredients(database, rowList, deletions);
      });
    });
  // Ingredients first: pulled recipes link to them.
  let ingredientsPulledUntil = await pullIngredients(cursors.pulledUntil.ingredients);
  // The server creation time of the oldest recipe this sync added here ('' = none).
  let oldestAddedCreated = '';
  const pullRecipes = async (since: string) => {
    // Recipes with ingredients not here yet: another phone pushed both after the pull above (its
    // ingredients first). Linked once those are pulled too.
    const unlinkedList: ServerRecipe[] = [];
    const apply = (rowList: readonly ServerRecipe[]) => {
      const applied = applyRecipes(database, rowList);
      oldestAddedCreated = earliest(oldestAddedCreated, applied.oldestAddedCreated);
      return applied.unlinkedList;
    };
    const pulledUntil = await pull(api, 'recipes', since, (rowList) => {
      holdChanges(() => {
        unlinkedList.push(...apply(rowList));
      });
    });
    if (unlinkedList.length > 0) {
      ingredientsPulledUntil = await pullIngredients(ingredientsPulledUntil);
      holdChanges(() => {
        apply(unlinkedList);
      });
    }
    return pulledUntil;
  };
  let recipesPulledUntil = await pullRecipes(cursors.pulledUntil.recipes);
  // A recipe added here that the server had before the last pull of meals: one deleted here and
  // brought back by a newer edit on another phone, whose meals went with it (ON DELETE CASCADE),
  // and that pull is past them. Every meal is pulled again then: only the missing ones are written.
  const hasMealsBehindCursor = () =>
    oldestAddedCreated !== '' &&
    oldestAddedCreated.localeCompare(cursors.pulledUntil.cooked_meals) < 0;
  // Meals of recipes not here yet (pushed by another phone after the pull above): applied once
  // the recipes are pulled again. Still missing then, the recipe was deleted: the meal goes too.
  const unmatchedList: ServerCookedMeal[] = [];
  const pullCookedMeals = (since: string) =>
    pull(api, 'cooked_meals', since, (rowList) => {
      holdChanges(() => {
        unmatchedList.push(...applyCookedMeals(database, rowList));
      });
    });
  const isFromStart = hasMealsBehindCursor();
  let cookedMealsPulledUntil = await pullCookedMeals(
    isFromStart ? '' : cursors.pulledUntil.cooked_meals,
  );
  if (unmatchedList.length > 0) {
    recipesPulledUntil = await pullRecipes(recipesPulledUntil);
    const retryList = unmatchedList.splice(0);
    holdChanges(() => {
      applyCookedMeals(database, retryList);
    });
    // The recipes pulled again brought one back (edited, and cooked, on another phone meanwhile).
    if (!isFromStart && hasMealsBehindCursor()) {
      cookedMealsPulledUntil = latest(cookedMealsPulledUntil, await pullCookedMeals(''));
    }
  }
  // Once every recipe is pulled, those pulled again for meals included.
  holdChanges(() => {
    settleDeletedIngredients(database, deletions);
  });
  await pullAccounts(database, api, holdChanges);
  if (photos) {
    await downloadPhotos(database, api, photos, holdChanges);
  }
  await pushDeletions(database, api, holdChanges);
  await pushIngredients(database, api, holdChanges);
  await pushRecipes(database, api, holdChanges);
  if (photos) {
    // After their recipes: the server has them (a photo is uploaded onto its recipe).
    await pushPhotos(database, api, photos, holdChanges);
  }
  await pushCookedMeals(database, api, holdChanges);
  return {
    pulledUntil: {
      cooked_meals: cookedMealsPulledUntil,
      ingredients: ingredientsPulledUntil,
      recipes: recipesPulledUntil,
    },
    // Still kept for an older app, should the phone go back to one.
    pushedFrom: startedAt,
    serverVersions: 'kept',
  };
}

// Before pulling: rows of a phone that synced with an older app (before server versions) are on
// the server if changed before the last push; after connecting, none is known to be (another server).
function prepareServerVersions(
  database: AppDatabase,
  cursors: Pick<SyncCursors, 'pushedFrom' | 'serverVersions'>,
): void {
  if (cursors.serverVersions === 'kept') {
    return;
  }
  database.transaction((tx) => {
    for (const table of [ingredients, recipes, cookedMeals]) {
      if (cursors.serverVersions === 'reset') {
        tx.update(table).set({ serverVersion: null }).where(isNotNull(table.serverVersion)).run();
      } else {
        tx.update(table)
          .set({ serverVersion: sql`${table.updatedAt}` })
          .where(lt(table.updatedAt, cursors.pushedFrom))
          .run();
      }
    }
  });
}
