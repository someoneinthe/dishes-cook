import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { Course, RecipeKind, Season, SyncedTable } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { Quantity } from '@/lib/units';
import { PAGE_SIZE } from '@/db/pagination';
import {
  accounts,
  cookedMeals,
  COURSE_LIST,
  ingredientAliases,
  ingredients,
  NOW_MS,
  recipeIngredients,
  recipes,
  SEASON_LIST,
  syncDeletions,
} from '@/db/schema';
import { toMinutes } from '@/features/recipes/minutes';
import { toMonths } from '@/features/recipes/months';
import { isSyncId } from '@/lib/sync-id';
import { cleanName, toNameKey, toSortKey } from '@/lib/text';
import { toQuantity, toStored } from '@/lib/units';
import type {
  PhotoUpload,
  PullPosition,
  ServerAccount,
  ServerCookedMeal,
  ServerIngredient,
  ServerRecipe,
  ServerRow,
  ServerRowOf,
  SyncApi,
  UpsertResult,
} from './sync-api';
import { SyncError } from './sync-api';

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

// At most this many pages pulled per table and per sync (a server that never stops sending rows
// can't keep the phone syncing forever): the next sync carries on.
const MAX_PULL_PAGES = 200;

// A server account's id (a recipe's author): 15 characters of [0-9a-z].
const ACCOUNT_ID = /^[\da-z]{15}$/;

// A server time: "2026-10-14 18:03:59.794Z".
const SERVER_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Recipe photos' files on the phone (src/features/recipes/recipe-photos.ts): what the sync reads,
// writes and deletes.
export type PhotoStore = Readonly<{
  // Deletes a photo's file (replaced by a download).
  delete: (file: string) => void;
  // Downloads a photo into a new file; resolves with its name.
  download: (url: string) => Promise<string>;
  // The photo's file to upload; undefined when it's missing.
  toUpload: (file: string) => PhotoUpload | undefined;
}>;

// Ingredients deleted on the server, left to settleDeletedIngredients: ids of ours a recipe here
// uses, and sync ids of other phones' ingredients of a name we have (aliases). Sets: the same rows
// may be pulled twice (pullRecipes pulls the ingredients again).
type PulledDeletions = Readonly<{ aliasSyncIds: Set<string>; usedIds: Set<number> }>;

type PullKey = Readonly<{ id: string; updated: string }>;

type PushCursor = Readonly<{ id: number; updatedAt: number }>;

type SyncedTableSchema = typeof cookedMeals | typeof ingredients | typeof recipes;

// At most this many photos downloaded, and uploaded, per sync: the next sync carries on.
const MAX_PHOTOS_PER_SYNC = 20;

// A photo to push: taken here and not uploaded yet, or removed here and still on the server.
const PHOTO_TO_PUSH = or(
  and(isNotNull(recipes.photoFile), isNull(recipes.photoSynced)),
  and(isNull(recipes.photoFile), isNotNull(recipes.photoSynced)),
);

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

// Applies a pulled meal; 'recipe-missing' when its recipe isn't here (yet).
function applyCookedMeal(tx: AppDatabase, row: ServerCookedMeal): 'done' | 'recipe-missing' {
  const cookedAt: unknown = row.cooked_at;
  if (
    !isValidRow(row) ||
    !isSyncId(row.recipe) ||
    !Number.isSafeInteger(cookedAt) ||
    (cookedAt as number) < 0
  ) {
    return 'done';
  }
  const local = tx
    .select({
      id: cookedMeals.id,
      serverVersion: cookedMeals.serverVersion,
      updatedAt: cookedMeals.updatedAt,
    })
    .from(cookedMeals)
    .where(eq(cookedMeals.syncId, row.id))
    .get();
  if (!isNewerThan(row, local)) {
    markOnServer(tx, cookedMeals, local, row);
    return 'done';
  }
  if (row.deleted > 0) {
    if (local) {
      // No deletion kept: the server has it.
      tx.delete(cookedMeals).where(eq(cookedMeals.id, local.id)).run();
    }
    return 'done';
  }
  if (isDeletedHereLater(tx, 'cooked_meals', row)) {
    return 'done';
  }
  const recipe = tx
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.syncId, row.recipe))
    .get();
  if (!recipe) {
    return 'recipe-missing';
  }
  const values = {
    cookedAt: cookedAt as number,
    recipeId: recipe.id,
    serverVersion: row.modified,
    updatedAt: row.modified,
  };
  if (local) {
    tx.update(cookedMeals).set(values).where(eq(cookedMeals.id, local.id)).run();
  } else {
    tx.insert(cookedMeals)
      .values({ ...values, syncId: row.id })
      .run();
    forgetDeletion(tx, 'cooked_meals', row.id);
  }
  return 'done';
}

// Applies pulled meals; returns those whose recipe isn't here (yet).
function applyCookedMeals(
  database: AppDatabase,
  rowList: readonly ServerCookedMeal[],
): readonly ServerCookedMeal[] {
  const unmatchedList: ServerCookedMeal[] = [];
  database.transaction((tx) => {
    for (const row of rowList) {
      if (applyCookedMeal(tx, row) === 'recipe-missing') {
        unmatchedList.push(row);
      }
    }
  });
  return unmatchedList;
}

function applyIngredient(tx: AppDatabase, row: ServerIngredient, deletions: PulledDeletions): void {
  const name = cleanName(typeof row.name === 'string' ? row.name : '');
  if (!name || !isValidRow(row)) {
    return;
  }
  const local = tx
    .select({
      id: ingredients.id,
      serverVersion: ingredients.serverVersion,
      updatedAt: ingredients.updatedAt,
    })
    .from(ingredients)
    .where(eq(ingredients.syncId, row.id))
    .get();
  if (!isNewerThan(row, local)) {
    markOnServer(tx, ingredients, local, row);
    return;
  }
  if (row.deleted > 0) {
    applyIngredientDeletion(tx, row.id, local?.id, deletions);
    return;
  }
  if (isDeletedHereLater(tx, 'ingredients', row)) {
    return;
  }
  const nameKey = toNameKey(name);
  const sameNameId = otherIngredientNamed(tx, nameKey, local?.id);
  if (sameNameId !== undefined) {
    // Renamed on another phone to a name an ingredient here has: ours is kept. Another phone's
    // ingredient of the same name, with another sync id: ours too, and its recipes link ours.
    if (!local) {
      tx.insert(ingredientAliases)
        .values({ ingredientId: sameNameId, syncId: row.id })
        .onConflictDoUpdate({ set: { ingredientId: sameNameId }, target: ingredientAliases.syncId })
        .run();
    }
    return;
  }
  // Saved in lowercase, whatever the other phone or the server had (shown with toDisplayName).
  const values = {
    name: nameKey,
    nameKey,
    serverVersion: row.modified,
    sortKey: toSortKey(name),
    updatedAt: row.modified,
  };
  if (local) {
    tx.update(ingredients).set(values).where(eq(ingredients.id, local.id)).run();
  } else {
    tx.insert(ingredients)
      .values({ ...values, syncId: row.id })
      .run();
    forgetAlias(tx, row.id);
    forgetDeletion(tx, 'ingredients', row.id);
  }
}

// Deleted on another phone: deleted here too, unless a recipe here uses it, or it was another
// phone's ingredient of a name we have (recipes pulled later may still list it): decided once the
// recipes are pulled (settleDeletedIngredients).
function applyIngredientDeletion(
  tx: AppDatabase,
  syncId: string,
  localId: number | undefined,
  deletions: PulledDeletions,
): void {
  if (localId === undefined) {
    if (hasAlias(tx, syncId)) {
      deletions.aliasSyncIds.add(syncId);
    }
  } else if (isIngredientUsed(tx, localId)) {
    deletions.usedIds.add(localId);
  } else {
    tx.delete(ingredients).where(eq(ingredients.id, localId)).run();
  }
}

function applyIngredients(
  database: AppDatabase,
  rowList: readonly ServerIngredient[],
  deletions: PulledDeletions,
): void {
  database.transaction((tx) => {
    for (const row of rowList) {
      applyIngredient(tx, row, deletions);
    }
  });
}

// A pulled recipe the phone has a newer (or the same) version of: its author is taken anyway. The
// server sets it, and gives it to the recipes from before authors without changing their version.
function applyKnownAuthor(
  tx: AppDatabase,
  local: Readonly<{ createdBy: null | string; id: number }> | undefined,
  row: ServerRecipe,
): void {
  const author = pulledAuthor(row);
  if (local && author && author !== local.createdBy) {
    // Not a change of the phone's (`updated_at` stays): nothing to push.
    tx.update(recipes).set({ createdBy: author }).where(eq(recipes.id, local.id)).run();
  }
}

// Applies a pulled recipe (`onAdded` is called when it's new here); returns how many of its
// ingredients aren't here (yet).
function applyRecipe(tx: AppDatabase, row: ServerRecipe, onAdded: () => void): number {
  // Saved in lowercase, whatever the other phone or the server had (shown with toDisplayName).
  const title = cleanName(typeof row.title === 'string' ? row.title : '').toLowerCase();
  if (!title || !isValidRow(row)) {
    return 0;
  }
  const local = tx
    .select({
      createdBy: recipes.createdBy,
      id: recipes.id,
      photoPending: recipes.photoPending,
      photoSynced: recipes.photoSynced,
      serverVersion: recipes.serverVersion,
      updatedAt: recipes.updatedAt,
    })
    .from(recipes)
    .where(eq(recipes.syncId, row.id))
    .get();
  if (!isNewerThan(row, local)) {
    markOnServer(tx, recipes, local, row);
    applyKnownAuthor(tx, local, row);
    applySameVersionPhoto(tx, local, row);
    return linkArrivedIngredients(tx, local, row);
  }
  if (row.deleted > 0) {
    if (local) {
      // Its links go with it (ON DELETE CASCADE). No deletion kept: the server has it.
      tx.delete(recipes).where(eq(recipes.id, local.id)).run();
    }
    return 0;
  }
  if (isDeletedHereLater(tx, 'recipes', row)) {
    return 0;
  }
  const values = {
    course: toCourse(row.course),
    // A server without an author never takes one away (like applyKnownAuthor).
    createdBy: pulledAuthor(row, local),
    instructions: typeof row.instructions === 'string' ? row.instructions.trim() : '',
    kind: toRecipeKind(row.kind),
    ...pulledTimes(row),
    season: toSeason(row.season),
    serverVersion: row.modified,
    sortKey: toSortKey(title),
    title,
    updatedAt: row.modified,
    ...pulledPhoto(row, local),
  };
  if (local) {
    tx.update(recipes).set(values).where(eq(recipes.id, local.id)).run();
    return linkIngredients(tx, local.id, row);
  }
  const { id } = tx
    .insert(recipes)
    .values({ ...values, syncId: row.id })
    .returning({ id: recipes.id })
    .get();
  forgetDeletion(tx, 'recipes', row.id);
  onAdded();
  return linkIngredients(tx, id, row);
}

// Applies pulled recipes; returns those with ingredients not here (yet), and the server creation
// time of the oldest one added here ('' = none, or no usable time).
function applyRecipes(
  database: AppDatabase,
  rowList: readonly ServerRecipe[],
): Readonly<{ oldestAddedCreated: string; unlinkedList: readonly ServerRecipe[] }> {
  const unlinkedList: ServerRecipe[] = [];
  let oldestAddedCreated = '';
  database.transaction((tx) => {
    for (const row of rowList) {
      const onAdded = () => {
        if (typeof row.created === 'string' && SERVER_TIME.test(row.created)) {
          oldestAddedCreated = earliest(oldestAddedCreated, row.created);
        }
      };
      if (applyRecipe(tx, row, onAdded) > 0) {
        unlinkedList.push(row);
      }
    }
  });
  return { oldestAddedCreated, unlinkedList };
}

// A pulled recipe of the same version as the phone's: its photo may have been uploaded since (a
// request of its own, which doesn't change `modified`): it's downloaded.
function applySameVersionPhoto(
  tx: AppDatabase,
  local:
    | Readonly<{
        id: number;
        photoPending: null | string;
        photoSynced: null | string;
        updatedAt: number;
      }>
    | undefined,
  row: ServerRecipe,
): void {
  // No photo on the server at the same version isn't a removal (a removal comes with a new version,
  // see pushRecipes): the server just hasn't got this phone's photo yet, which the push uploads.
  if (local?.updatedAt !== row.modified || row.deleted > 0 || !row.photo) {
    return;
  }
  const photo = pulledPhoto(row, local);
  if (photo.photoPending !== local.photoPending) {
    tx.update(recipes).set(photo).where(eq(recipes.id, local.id)).run();
  }
}

// Downloads a recipe's photo; resolves with its file, or undefined when this photo failed (tried
// again next time). Fails when it isn't this photo's fault (no server, no sign-in).
async function downloadPhoto(
  api: SyncApi,
  photos: PhotoStore,
  syncId: string,
  name: string,
): Promise<string | undefined> {
  try {
    return await photos.download(await api.recipePhotoUrl(syncId, name));
  } catch (error) {
    if (error instanceof SyncError) {
      throw error;
    }
    return undefined;
  }
}

// Downloads the photos pulled from other phones (photo_pending), a few per sync. The file replaces
// the recipe's photo only if nothing changed it meanwhile; a photo that fails stays to download.
async function downloadPhotos(
  database: AppDatabase,
  api: SyncApi,
  photos: PhotoStore,
  holdChanges: (write: () => void) => void,
): Promise<void> {
  const rowList = database
    .select({
      id: recipes.id,
      photoFile: recipes.photoFile,
      photoPending: recipes.photoPending,
      syncId: recipes.syncId,
    })
    .from(recipes)
    .where(isNotNull(recipes.photoPending))
    .limit(MAX_PHOTOS_PER_SYNC)
    .all();
  // Side by side, as recipes are pushed; the sync fails only once they have all ended.
  await settleAll(
    rowList.map(async (row) => {
      const pending = row.photoPending ?? '';
      const file = await downloadPhoto(api, photos, row.syncId, pending);
      if (file === undefined) {
        return;
      }
      holdChanges(() => {
        const appliedList = database
          .update(recipes)
          .set({ photoFile: file, photoPending: null, photoSynced: pending })
          .where(and(eq(recipes.id, row.id), eq(recipes.photoPending, pending)))
          .returning({ id: recipes.id })
          .all();
        // Changed meanwhile (another photo, or none): this download isn't wanted any more.
        const unusedFile = appliedList.length === 0 ? file : row.photoFile;
        if (unusedFile !== null) {
          photos.delete(unusedFile);
        }
      });
    }),
  );
}

// The earlier of two server times, '' standing for none.
function earliest(time: string, other: string): string {
  return time === '' || (other !== '' && other.localeCompare(time) < 0) ? other : time;
}

function forgetAlias(tx: AppDatabase, syncId: string) {
  tx.delete(ingredientAliases).where(eq(ingredientAliases.syncId, syncId)).run();
}

function forgetDeletion(tx: AppDatabase, tableName: SyncedTable, syncId: string) {
  tx.delete(syncDeletions)
    .where(and(eq(syncDeletions.tableName, tableName), eq(syncDeletions.syncId, syncId)))
    .run();
}

function hasAlias(tx: AppDatabase, syncId: string): boolean {
  return (
    tx
      .select({ syncId: ingredientAliases.syncId })
      .from(ingredientAliases)
      .where(eq(ingredientAliases.syncId, syncId))
      .get() !== undefined
  );
}

// The sync ids of a pulled recipe's ingredients, once each.
function ingredientSyncIdsOf(row: Pick<ServerRecipe, 'ingredients'>): string[] {
  return Array.isArray(row.ingredients)
    ? [...new Set(row.ingredients.filter((syncId) => isSyncId(syncId)))]
    : [];
}

// Whether a row comes after a pull position, in the (updated, id) order.
function isAfter(key: PullKey, position: PullPosition): boolean {
  if ('since' in position) {
    return key.updated.localeCompare(position.since) >= 0;
  }
  const { id, updated } = position.after;
  const byTime = key.updated.localeCompare(updated);
  return byTime > 0 || (byTime === 0 && key.id.localeCompare(id) > 0);
}

// Deleted here after the server's change: the deletion is pushed by this sync.
function isDeletedHereLater(tx: AppDatabase, tableName: SyncedTable, row: ServerRow): boolean {
  const deletion = tx
    .select({ deletedAt: syncDeletions.deletedAt })
    .from(syncDeletions)
    .where(and(eq(syncDeletions.tableName, tableName), eq(syncDeletions.syncId, row.id)))
    .get();
  return deletion !== undefined && deletion.deletedAt >= row.modified;
}

function isIngredientUsed(tx: AppDatabase, id: number): boolean {
  const link = tx
    .select({ recipeId: recipeIngredients.recipeId })
    .from(recipeIngredients)
    .where(eq(recipeIngredients.ingredientId, id))
    .limit(1)
    .get();
  return link !== undefined;
}

// No row here, or an older one. Equal times are the same change (pulled before, or pushed by us).
function isNewerThan(row: ServerRow, local: Readonly<{ updatedAt: number }> | undefined) {
  return local === undefined || row.modified > local.updatedAt;
}

// An account as the server lists it: a usable id (its name is checked by toAccount).
function isServerAccount(item: unknown): item is Readonly<{ id: string; name?: unknown }> {
  return (
    typeof item === 'object' &&
    item !== null &&
    ACCOUNT_ID.test(String((item as { id?: unknown }).id))
  );
}

// Whether the server's photo of a recipe is the one the phone shows (uploaded or downloaded), or
// one it hasn't downloaded yet: then a push of the recipe leaves it.
function isServerPhotoKept(
  row: Readonly<{
    photoFile: null | string;
    photoPending: null | string;
    photoSynced: null | string;
  }>,
): boolean {
  return row.photoPending !== null || (row.photoFile !== null && row.photoSynced !== null);
}

// An item of a pulled page is an object; its fields are checked when it's applied.
function isServerRow(item: unknown): item is ServerRow {
  return typeof item === 'object' && item !== null && !Array.isArray(item);
}

// Rows from the server are checked before use: a bad one is skipped, not a failed sync.
function isValidRow(row: ServerRow): boolean {
  return (
    isSyncId(row.id) &&
    Number.isSafeInteger(row.modified) &&
    row.modified >= 0 &&
    Number.isSafeInteger(row.deleted)
  );
}

// The later of two server times: "2026-10-14 18:03:59.794Z" strings of the same length sort in
// time order, digit by digit.
function latest(time: string, other: unknown): string {
  return typeof other === 'string' && other.localeCompare(time) > 0 ? other : time;
}

// A recipe pulled again, not newer than the phone's: when it's the same version, links its
// ingredients that weren't here when it was first pulled, if any arrived since (it writes nothing
// otherwise). Returns how many are still missing.
function linkArrivedIngredients(
  tx: AppDatabase,
  local: Readonly<{ id: number; updatedAt: number }> | undefined,
  row: ServerRecipe,
): number {
  const syncIdList = ingredientSyncIdsOf(row);
  if (local?.updatedAt !== row.modified || row.deleted > 0 || syncIdList.length === 0) {
    return 0;
  }
  const localIdMap = localIngredientIds(tx, syncIdList);
  const linkedIdSet = new Set(
    tx
      .select({ ingredientId: recipeIngredients.ingredientId })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, local.id))
      .all()
      .map(({ ingredientId }) => ingredientId),
  );
  return [...localIdMap.values()].some((id) => !linkedIdSet.has(id))
    ? linkIngredients(tx, local.id, row)
    : syncIdList.length - localIdMap.size;
}

// Replaces the recipe's ingredients (and their quantities) with the pulled ones; those not here
// (yet) are left out, and so are quantities that aren't usable. An ingredient this phone has under
// another sync id (same name, see ingredientAliases) is linked as its own. Returns how many were
// left out.
function linkIngredients(
  tx: AppDatabase,
  recipeId: number,
  row: Pick<ServerRecipe, 'ingredients' | 'quantities'>,
): number {
  tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId)).run();
  const syncIdList = ingredientSyncIdsOf(row);
  if (syncIdList.length === 0) {
    return 0;
  }
  const localIdMap = localIngredientIds(tx, syncIdList);
  // One link per ingredient here, with the quantity of the first sync id naming it.
  const linkMap = new Map<number, Quantity | undefined>();
  for (const syncId of syncIdList) {
    const ingredientId = localIdMap.get(syncId);
    if (ingredientId !== undefined && !linkMap.has(ingredientId)) {
      linkMap.set(ingredientId, pulledQuantity(row.quantities, syncId));
    }
  }
  if (linkMap.size > 0) {
    tx.insert(recipeIngredients)
      .values(
        [...linkMap].map(([ingredientId, quantity]) => ({
          amount: quantity?.amount ?? null,
          ingredientId,
          recipeId,
          unit: quantity?.unit ?? null,
        })),
      )
      .run();
  }
  return syncIdList.length - localIdMap.size;
}

// This phone's ingredients for these sync ids: its own, or the one an alias names.
function localIngredientIds(tx: AppDatabase, syncIdList: readonly string[]): Map<string, number> {
  const aliasList = tx
    .select({ id: ingredientAliases.ingredientId, syncId: ingredientAliases.syncId })
    .from(ingredientAliases)
    .where(inArray(ingredientAliases.syncId, [...syncIdList]))
    .all();
  const ownList = tx
    .select({ id: ingredients.id, syncId: ingredients.syncId })
    .from(ingredients)
    .where(inArray(ingredients.syncId, [...syncIdList]))
    .all();
  return new Map([...aliasList, ...ownList].map(({ id, syncId }) => [syncId, id]));
}

// A pulled row of the same version as the phone's: the server has it (pulled before, or pushed by
// an older app, which didn't keep the version), so it isn't pushed.
function markOnServer(
  tx: AppDatabase,
  table: SyncedTableSchema,
  local: Readonly<{ id: number; serverVersion: null | number; updatedAt: number }> | undefined,
  row: ServerRow,
): void {
  if (local?.updatedAt === row.modified && local.serverVersion !== row.modified) {
    tx.update(table).set({ serverVersion: row.modified }).where(eq(table.id, local.id)).run();
  }
}

// Keeps the version of each row the server saved: not pushed again, unless changed meanwhile (a
// newer version). Then fails with the first error, if any.
function markPushed(
  database: AppDatabase,
  holdChanges: (write: () => void) => void,
  table: SyncedTableSchema,
  pushedList: readonly Readonly<{ id: number; updatedAt: number }>[],
  resultList: readonly PromiseSettledResult<UpsertResult>[],
): void {
  holdChanges(() => {
    database.transaction((tx) => {
      for (const [index, row] of pushedList.entries()) {
        const result = resultList[index];
        if (result?.status === 'fulfilled' && result.value === 'saved') {
          tx.update(table)
            .set({ serverVersion: row.updatedAt })
            .where(and(eq(table.id, row.id), eq(table.updatedAt, row.updatedAt)))
            .run();
        }
      }
    });
  });
  throwFirstFailure(resultList);
}

// The rows the server doesn't have in this version: in the *_to_push_idx indexes.
function notOnServer(table: SyncedTableSchema) {
  return sql`${table.serverVersion} is not ${table.updatedAt}`;
}

// The other ingredient here with this name (not `id`), if any.
function otherIngredientNamed(
  tx: AppDatabase,
  nameKey: string,
  id: number | undefined,
): number | undefined {
  return tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      id === undefined
        ? eq(ingredients.nameKey, nameKey)
        : and(eq(ingredients.nameKey, nameKey), ne(ingredients.id, id)),
    )
    .get()?.id;
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

// Pages through the rows written on the server since `since`, applying each page; returns the
// time of the last row pulled, where the next pull starts.
async function pull<Table extends SyncedTable>(
  api: SyncApi,
  table: Table,
  since: string,
  apply: (rowList: readonly ServerRowOf<Table>[]) => void,
): Promise<string> {
  let position: PullPosition = { since };
  let pulledUntil = since;
  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    // eslint-disable-next-line no-await-in-loop -- pages one after another: each starts at the previous one's cursor
    const itemList = await api.listChanges(table, position);
    apply(itemList.filter((item): item is ServerRowOf<Table> => isServerRow(item)));
    for (const item of itemList) {
      pulledUntil = latest(pulledUntil, toPullKey(item)?.updated);
    }
    if (itemList.length < PAGE_SIZE) {
      return pulledUntil;
    }
    // The next page starts after this one's last row, which must come after where it started:
    // a server sending the same rows again would keep the phone pulling forever.
    const last = toPullKey(itemList.at(-1));
    if (!last || !isAfter(last, position)) {
      throw new SyncError('failed', `Unexpected page of ${table}`);
    }
    position = { after: last };
  }
  return pulledUntil;
}

// The server's accounts, all of them (a household's few), in place of the ones kept here: who added
// a recipe is shown by name. Kept as they were when the server doesn't list them all.
async function pullAccounts(
  database: AppDatabase,
  api: SyncApi,
  holdChanges: (write: () => void) => void,
): Promise<void> {
  const accountList: ServerAccount[] = [];
  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    // eslint-disable-next-line no-await-in-loop -- pages one after another: each starts after the previous one's last id
    const itemList = await api.listAccounts(accountList.at(-1)?.id ?? '');
    accountList.push(
      ...itemList.filter((item) => isServerAccount(item)).map((item) => toAccount(item)),
    );
    if (itemList.length < PAGE_SIZE) {
      holdChanges(() => {
        database.transaction((tx) => {
          tx.delete(accounts).run();
          if (accountList.length > 0) {
            tx.insert(accounts).values(accountList).onConflictDoNothing().run();
          }
        });
      });
      return;
    }
  }
}

// A pulled recipe's author: the account's id; without a usable one, what the phone already has
// (`local`: null for one added here, still the phone's own), or '' (none) for a new recipe.
function pulledAuthor(
  row: ServerRecipe,
  local?: Readonly<{ createdBy: null | string }>,
): null | string {
  if (typeof row.created_by === 'string' && ACCOUNT_ID.test(row.created_by)) {
    return row.created_by;
  }
  return local ? local.createdBy : '';
}

// A pulled recipe's photo, compared with the phone's: none (the photo goes), the one the phone has,
// or another one, to download (the phone's stays until then).
function pulledPhoto(
  row: Pick<ServerRecipe, 'photo'>,
  local: Readonly<{ photoSynced: null | string }> | undefined,
): Readonly<{ photoFile?: null; photoPending: null | string; photoSynced?: null }> {
  const name = typeof row.photo === 'string' ? row.photo : '';
  if (name === '') {
    return { photoFile: null, photoPending: null, photoSynced: null };
  }
  return { photoPending: name === local?.photoSynced ? null : name };
}

// The pulled quantity of an ingredient, if the server has a usable one.
function pulledQuantity(quantities: unknown, syncId: string): Quantity | undefined {
  if (typeof quantities !== 'object' || quantities === null || !Object.hasOwn(quantities, syncId)) {
    return undefined;
  }
  const value: unknown = (quantities as Record<string, unknown>)[syncId];
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { amount, unit } = value as Record<string, unknown>;
  // Stored like the phone's own: a server row written in another unit ("1.5 kg") is normalized.
  const quantity = toQuantity(amount, unit);
  const stored = quantity && toStored(quantity);
  // Checked again once converted: "100000000 kg" is too much once in grams, and couldn't be pushed.
  return stored && toQuantity(stored.amount, stored.unit);
}

// A pulled recipe's times, kept when usable: minutes, and a drink's maturation in months.
function pulledTimes(row: ServerRecipe) {
  return {
    cookMinutes: toMinutes(row.cook_minutes) ?? null,
    maturationMonths: toMonths(row.maturation_months) ?? null,
    prepMinutes: toMinutes(row.prep_minutes) ?? null,
  };
}

async function pushCookedMeals(
  database: AppDatabase,
  api: SyncApi,
  holdChanges: (write: () => void) => void,
): Promise<void> {
  let cursor: PushCursor | undefined;
  for (;;) {
    const rowList = database
      .select({
        cookedAt: cookedMeals.cookedAt,
        id: cookedMeals.id,
        recipeId: cookedMeals.recipeId,
        syncId: cookedMeals.syncId,
        updatedAt: cookedMeals.updatedAt,
      })
      .from(cookedMeals)
      .where(toPush(cookedMeals, cursor))
      .orderBy(asc(cookedMeals.updatedAt), asc(cookedMeals.id))
      .limit(PAGE_SIZE)
      .all();
    // The page's recipes' sync ids in one query.
    const recipeIdList = rowList.map(({ recipeId }) => recipeId);
    const recipeList =
      recipeIdList.length === 0
        ? []
        : database
            .select({ id: recipes.id, syncId: recipes.syncId })
            .from(recipes)
            .where(inArray(recipes.id, recipeIdList))
            .all();
    const recipeSyncIdMap = new Map(recipeList.map(({ id, syncId }) => [id, syncId]));
    // Always found: a meal goes with its recipe (ON DELETE CASCADE).
    const pushedList = rowList.filter(({ recipeId }) => recipeSyncIdMap.has(recipeId));
    // eslint-disable-next-line no-await-in-loop -- pages one after another: each starts at the previous one's cursor
    const resultList = await Promise.allSettled(
      pushedList.map((row) =>
        api.upsert('cooked_meals', row.syncId, {
          cooked_at: row.cookedAt,
          deleted: 0,
          modified: row.updatedAt,
          recipe: recipeSyncIdMap.get(row.recipeId) ?? '',
        }),
      ),
    );
    markPushed(database, holdChanges, cookedMeals, pushedList, resultList);
    cursor = rowList.at(-1);
    if (rowList.length < PAGE_SIZE) {
      return;
    }
  }
}

async function pushDeletions(
  database: AppDatabase,
  api: SyncApi,
  holdChanges: (write: () => void) => void,
): Promise<void> {
  for (;;) {
    const deletionList = database
      .select()
      .from(syncDeletions)
      .orderBy(asc(syncDeletions.deletedAt))
      .limit(PAGE_SIZE)
      .all();
    // A page's rows are independent: sent together. The ones sent are forgotten, together; when
    // one is missing on the server (never pushed) or changed there later, there's nothing more to
    // tell.
    // eslint-disable-next-line no-await-in-loop -- pages one after another: each starts at the previous one's cursor
    const resultList = await Promise.allSettled(
      deletionList.map((deletion) =>
        api.sendDeletion(deletion.tableName, deletion.syncId, deletion.deletedAt),
      ),
    );
    holdChanges(() => {
      database.transaction((tx) => {
        for (const [index, deletion] of deletionList.entries()) {
          if (resultList[index]?.status === 'fulfilled') {
            forgetDeletion(tx, deletion.tableName, deletion.syncId);
          }
        }
      });
    });
    throwFirstFailure(resultList);
    if (deletionList.length < PAGE_SIZE) {
      return;
    }
  }
}

async function pushIngredients(
  database: AppDatabase,
  api: SyncApi,
  holdChanges: (write: () => void) => void,
): Promise<void> {
  let cursor: PushCursor | undefined;
  for (;;) {
    const rowList = database
      .select({
        id: ingredients.id,
        name: ingredients.name,
        syncId: ingredients.syncId,
        updatedAt: ingredients.updatedAt,
      })
      .from(ingredients)
      .where(toPush(ingredients, cursor))
      .orderBy(asc(ingredients.updatedAt), asc(ingredients.id))
      .limit(PAGE_SIZE)
      .all();
    // eslint-disable-next-line no-await-in-loop -- pages one after another: each starts at the previous one's cursor
    const resultList = await Promise.allSettled(
      rowList.map((row) =>
        api.upsert('ingredients', row.syncId, {
          deleted: 0,
          modified: row.updatedAt,
          name: row.name,
        }),
      ),
    );
    markPushed(database, holdChanges, ingredients, rowList, resultList);
    cursor = rowList.at(-1);
    if (rowList.length < PAGE_SIZE) {
      return;
    }
  }
}

// Uploads the photos taken here, and marks as gone those removed here (cleared on the server with
// their recipe by pushRecipes, cleared again: harmless), a few per sync. A photo whose recipe
// changed meanwhile (another photo) is pushed by the next sync.
async function pushPhotos(
  database: AppDatabase,
  api: SyncApi,
  photos: PhotoStore,
  holdChanges: (write: () => void) => void,
): Promise<void> {
  const rowList = database
    .select({
      id: recipes.id,
      photoFile: recipes.photoFile,
      syncId: recipes.syncId,
      updatedAt: recipes.updatedAt,
    })
    .from(recipes)
    .where(PHOTO_TO_PUSH)
    .limit(MAX_PHOTOS_PER_SYNC)
    .all();
  await settleAll(
    rowList.map(async (row) => {
      const upload = row.photoFile === null ? null : photos.toUpload(row.photoFile);
      // Its file is missing (deleted outside the app): the recipe has no photo any more, never
      // uploaded (photoSynced null), so it stops waiting for the push.
      if (upload === undefined) {
        holdChanges(() => {
          database
            .update(recipes)
            .set({ photoFile: null })
            .where(and(eq(recipes.id, row.id), eq(recipes.photoFile, row.photoFile ?? '')))
            .run();
        });
        return;
      }
      const result = await api.setRecipePhoto(row.syncId, upload, row.updatedAt);
      if (result === 'kept-newer') {
        return;
      }
      holdChanges(() => {
        database
          .update(recipes)
          .set({ photoSynced: row.photoFile === null ? null : result.name })
          .where(
            and(
              eq(recipes.id, row.id),
              row.photoFile === null
                ? isNull(recipes.photoFile)
                : eq(recipes.photoFile, row.photoFile),
            ),
          )
          .run();
      });
    }),
  );
}

async function pushRecipes(
  database: AppDatabase,
  api: SyncApi,
  holdChanges: (write: () => void) => void,
): Promise<void> {
  let cursor: PushCursor | undefined;
  for (;;) {
    const rowList = database
      .select({
        cookMinutes: recipes.cookMinutes,
        course: recipes.course,
        id: recipes.id,
        instructions: recipes.instructions,
        kind: recipes.kind,
        maturationMonths: recipes.maturationMonths,
        photoFile: recipes.photoFile,
        photoPending: recipes.photoPending,
        photoSynced: recipes.photoSynced,
        prepMinutes: recipes.prepMinutes,
        season: recipes.season,
        syncId: recipes.syncId,
        title: recipes.title,
        updatedAt: recipes.updatedAt,
      })
      .from(recipes)
      .where(toPush(recipes, cursor))
      .orderBy(asc(recipes.updatedAt), asc(recipes.id))
      .limit(PAGE_SIZE)
      .all();
    // The page's ingredient links in one query, grouped by recipe.
    const linkList =
      rowList.length === 0
        ? []
        : database
            .select({
              amount: recipeIngredients.amount,
              recipeId: recipeIngredients.recipeId,
              syncId: ingredients.syncId,
              unit: recipeIngredients.unit,
            })
            .from(recipeIngredients)
            .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
            .where(
              inArray(
                recipeIngredients.recipeId,
                rowList.map(({ id }) => id),
              ),
            )
            .orderBy(asc(recipeIngredients.recipeId), asc(ingredients.syncId))
            .all();
    const ingredientSyncIdsByRecipe = new Map<number, string[]>();
    // { "<ingredient sync id>": { amount, unit? } } by recipe: the links that have a quantity.
    const quantitiesByRecipe = new Map<number, Record<string, Quantity>>();
    for (const link of linkList) {
      const syncIdList = ingredientSyncIdsByRecipe.get(link.recipeId) ?? [];
      syncIdList.push(link.syncId);
      ingredientSyncIdsByRecipe.set(link.recipeId, syncIdList);
      const quantities = quantitiesByRecipe.get(link.recipeId) ?? {};
      const quantity = toQuantity(link.amount, link.unit);
      if (quantity) {
        quantities[link.syncId] = quantity;
      }
      quantitiesByRecipe.set(link.recipeId, quantities);
    }
    // eslint-disable-next-line no-await-in-loop -- pages one after another: each starts at the previous one's cursor
    const resultList = await Promise.allSettled(
      rowList.map((row) =>
        api.upsert('recipes', row.syncId, {
          // 0 = not given (a number field can't be empty).
          cook_minutes: row.cookMinutes ?? 0,
          course: row.course,
          deleted: 0,
          ingredients: ingredientSyncIdsByRecipe.get(row.id) ?? [],
          instructions: row.instructions,
          kind: row.kind,
          maturation_months: row.maturationMonths ?? 0,
          modified: row.updatedAt,
          // The server's photo goes with the recipe's new version, never after it (a phone
          // pulling in between would keep it), unless it's the one this phone shows or is about
          // to download: removed here, or replaced (pushPhotos then uploads the new one onto
          // this version), or the new photo's file went missing.
          ...(!isServerPhotoKept(row) && { photo: '' }),
          prep_minutes: row.prepMinutes ?? 0,
          quantities: quantitiesByRecipe.get(row.id) ?? {},
          season: row.season,
          title: row.title,
        }),
      ),
    );
    markPushed(database, holdChanges, recipes, rowList, resultList);
    cursor = rowList.at(-1);
    if (rowList.length < PAGE_SIZE) {
      return;
    }
  }
}

// Waits for every request of a page, then fails with the first error if any: no request is left
// running once the sync has ended (the next one could overlap it).
async function settleAll(promiseList: readonly Promise<unknown>[]): Promise<void> {
  throwFirstFailure(await Promise.allSettled(promiseList));
}

// Another phone's ingredient of a name we have, deleted on the server: its alias goes, and the
// recipes linking ours are pushed again, as the server's may still list it. Later than the version
// pulled, which may come from a phone whose clock is ahead.
function settleDeletedAlias(tx: AppDatabase, syncId: string): void {
  const alias = tx
    .select({ ingredientId: ingredientAliases.ingredientId })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.syncId, syncId))
    .get();
  if (!alias) {
    return;
  }
  const linkedRecipeIds = tx
    .select({ id: recipeIngredients.recipeId })
    .from(recipeIngredients)
    .where(eq(recipeIngredients.ingredientId, alias.ingredientId));
  tx.update(recipes)
    .set({ updatedAt: sql`max(${NOW_MS}, ${recipes.updatedAt} + 1)` })
    .where(inArray(recipes.id, linkedRecipeIds))
    .run();
  forgetAlias(tx, syncId);
}

// Ingredients deleted on another phone that a recipe here used when they were pulled: deleted now
// that no recipe here uses them (their recipes' deletions came with this sync), or kept and pushed
// again when one still does (added here since). Aliases: see settleDeletedAlias.
function settleDeletedIngredients(database: AppDatabase, deletions: PulledDeletions): void {
  if (deletions.aliasSyncIds.size === 0 && deletions.usedIds.size === 0) {
    return;
  }
  database.transaction((tx) => {
    for (const syncId of deletions.aliasSyncIds) {
      settleDeletedAlias(tx, syncId);
    }
    for (const id of deletions.usedIds) {
      if (isIngredientUsed(tx, id)) {
        tx.update(ingredients).set({ updatedAt: NOW_MS }).where(eq(ingredients.id, id)).run();
      } else {
        tx.delete(ingredients).where(eq(ingredients.id, id)).run();
      }
    }
  });
}

function throwFirstFailure(resultList: readonly PromiseSettledResult<unknown>[]): void {
  for (const result of resultList) {
    if (result.status === 'rejected') {
      throw result.reason;
    }
  }
}

// At most 100 characters of a name, trimmed; '' for none.
function toAccount(item: Readonly<{ id: string; name?: unknown }>): ServerAccount {
  return { id: item.id, name: typeof item.name === 'string' ? item.name.trim().slice(0, 100) : '' };
}

function toCourse(value: string): Course {
  return COURSE_LIST.includes(value as Course) ? (value as Course) : 'main';
}

// Where a pulled row sits in the (updated, id) order; undefined for an item without a usable id
// or time.
function toPullKey(item: unknown): PullKey | undefined {
  if (!isServerRow(item)) {
    return undefined;
  }
  const { id, updated } = item as Partial<Record<keyof ServerRow, unknown>>;
  return typeof updated === 'string' && SERVER_TIME.test(updated) && isSyncId(id)
    ? { id, updated }
    : undefined;
}

// The rows to push after the keyset cursor (the last row of the previous page), in (updated_at, id)
// order: read from the *_to_push_idx indexes, from the cursor on.
function toPush(table: SyncedTableSchema, cursor: PushCursor | undefined) {
  return cursor
    ? and(
        notOnServer(table),
        sql`(${table.updatedAt}, ${table.id}) > (${cursor.updatedAt}, ${cursor.id})`,
      )
    : notOnServer(table);
}

// A pulled recipe's kind: a dish unless it says drink (empty on a server from before drinks).
function toRecipeKind(value: unknown): RecipeKind {
  return value === 'drink' ? 'drink' : 'dish';
}

function toSeason(value: string): Season {
  return SEASON_LIST.includes(value as Season) ? (value as Season) : 'both';
}
