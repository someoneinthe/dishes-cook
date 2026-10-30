import { and, eq, inArray, ne, sql } from 'drizzle-orm';
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
import type { SyncedContent } from './recipe-merge';
import type {
  PullPosition,
  ServerAccount,
  ServerCookedMeal,
  ServerIngredient,
  ServerRecipe,
  ServerRow,
  ServerRowOf,
  SyncApi,
} from './sync-api';
import type { SyncedTableSchema } from './sync-shared';
import { isSameContent, mergeContent, parseSyncedContent } from './recipe-merge';
import { SyncError } from './sync-api';
import { applySameVersionPhoto, pulledPhoto } from './sync-photos';
import { earliest, forgetDeletion, isServerRow, isValidRow, latest } from './sync-shared';

// The pull half of the sync (sync-engine.ts): pages of rows written on the server since the last
// pull, applied when newer than the phone's, and the accounts' names (see docs/sync.md).

// At most this many pages pulled per table and per sync (a server that never stops sending rows
// can't keep the phone syncing forever): the next sync carries on.
const MAX_PULL_PAGES = 200;

// A server account's id (a recipe's author): 15 characters of [0-9a-z].
const ACCOUNT_ID = /^[\da-z]{15}$/;

// A server time: "2026-10-14 18:03:59.794Z".
const SERVER_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Ingredients deleted on the server, left to settleDeletedIngredients: ids of ours a recipe here
// uses, and sync ids of other phones' ingredients of a name we have (aliases). Sets: the same rows
// may be pulled twice (pullRecipes pulls the ingredients again).
export type PulledDeletions = Readonly<{ aliasSyncIds: Set<string>; usedIds: Set<number> }>;

type PullKey = Readonly<{ id: string; updated: string }>;

// Applies pulled meals; returns those whose recipe isn't here (yet).
export function applyCookedMeals(
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

export function applyIngredients(
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

// Applies pulled recipes; returns those with ingredients not here (yet), and the server creation
// time of the oldest one added here ('' = none, or no usable time).
export function applyRecipes(
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

// Pages through the rows written on the server since `since`, applying each page; returns the
// time of the last row pulled, where the next pull starts.
export async function pull<Table extends SyncedTable>(
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
export async function pullAccounts(
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

// Ingredients deleted on another phone that a recipe here used when they were pulled: deleted now
// that no recipe here uses them (their recipes' deletions came with this sync), or kept and pushed
// again when one still does (added here since). Aliases: see settleDeletedAlias.
export function settleDeletedIngredients(database: AppDatabase, deletions: PulledDeletions): void {
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
      photoFile: recipes.photoFile,
      photoPending: recipes.photoPending,
      photoSynced: recipes.photoSynced,
      serverVersion: recipes.serverVersion,
      syncedContent: recipes.syncedContent,
      updatedAt: recipes.updatedAt,
    })
    .from(recipes)
    .where(eq(recipes.syncId, row.id))
    .get();
  const mergedCount = mergeIfChangedOnBothSides(tx, local, row, title);
  if (mergedCount !== undefined) {
    return mergedCount;
  }
  if (!isNewerThan(row, local)) {
    markRecipeOnServer(tx, local, row, title);
    applyKnownAuthor(tx, local, row);
    applySameVersionPhoto(tx, local, row);
    return linkArrivedIngredients(tx, local, row, title);
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
  const claimed = claimTitle(tx, title, row.id);
  const values = {
    course: toCourse(row.course),
    // A server without an author never takes one away (like applyKnownAuthor).
    createdBy: pulledAuthor(row, local),
    instructions: typeof row.instructions === 'string' ? row.instructions.trim() : '',
    kind: toRecipeKind(row.kind),
    ...pulledTimes(row),
    season: toSeason(row.season),
    serverVersion: row.modified,
    sortKey: toSortKey(claimed.title),
    syncedContent: JSON.stringify(remoteContent(tx, row, title)),
    title: claimed.title,
    // Renamed here: newer than the server's version, which takes the new title from this phone.
    updatedAt: claimed.isRenamed ? row.modified + 1 : row.modified,
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

// Titles are unique, ignoring case and accents (recipes_sort_key_unique): when the recipe `syncId`
// is to have the title of another recipe here (added on two phones, or renamed on one), the one with
// the larger sync id takes the first free number, "crêpes (2)", the same choice on every phone.
// Returns the title for `syncId`, and whether it's numbered (it then needs a newer version). The
// other recipe, numbered, gets one here, pushed by this sync.
function claimTitle(
  tx: AppDatabase,
  title: string,
  syncId: string,
): Readonly<{ isRenamed: boolean; title: string }> {
  const other = otherRecipeTitled(tx, title, syncId);
  if (!other) {
    return { isRenamed: false, title };
  }
  if (isAfterInBinaryOrder(syncId, other.syncId)) {
    return { isRenamed: true, title: numberedTitle(tx, title, syncId) };
  }
  const otherTitle = numberedTitle(tx, other.title, other.syncId);
  tx.update(recipes)
    .set({
      sortKey: toSortKey(otherTitle),
      title: otherTitle,
      updatedAt: sql`max(${recipes.updatedAt} + 1, ${NOW_MS})`,
    })
    .where(eq(recipes.id, other.id))
    .run();
  return { isRenamed: false, title };
}

function forgetAlias(tx: AppDatabase, syncId: string) {
  tx.delete(ingredientAliases).where(eq(ingredientAliases.syncId, syncId)).run();
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

// Changed here since the phone last agreed with the server (`server_version`), and changed on the
// server since too (another phone pushed a newer version): both changes are to keep.
// Whether `syncId` comes after `other` in SQLite's BINARY order (ORDER BY sync_id, migration 0013):
// by character code, never a locale's collation, so that every phone makes the same choice.
function isAfterInBinaryOrder(syncId: string, other: string): boolean {
  for (let index = 0; index < Math.min(syncId.length, other.length); index += 1) {
    const difference = (syncId.codePointAt(index) ?? 0) - (other.codePointAt(index) ?? 0);
    if (difference !== 0) {
      return difference > 0;
    }
  }
  return syncId.length > other.length;
}

function isChangedOnBothSides(
  local: Readonly<{ serverVersion: null | number; updatedAt: number }>,
  row: ServerRecipe,
): boolean {
  return (
    row.deleted === 0 &&
    local.serverVersion !== null &&
    local.updatedAt !== local.serverVersion &&
    row.modified > local.serverVersion
  );
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

// A photo taken or removed here and not synced yet (see PHOTO_TO_PUSH): it stays through a merge.
function isLocalPhotoChanged(
  local: Readonly<{ photoFile: null | string; photoSynced: null | string }>,
): boolean {
  return (local.photoFile === null) !== (local.photoSynced === null);
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

// A recipe pulled again, not newer than the phone's: when it's the same version, links its
// ingredients that weren't here when it was first pulled, if any arrived since (it writes nothing
// otherwise). Returns how many are still missing.
function linkArrivedIngredients(
  tx: AppDatabase,
  local: Readonly<{ id: number; updatedAt: number }> | undefined,
  row: ServerRecipe,
  title: string,
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
  if ([...localIdMap.values()].every((id) => linkedIdSet.has(id))) {
    return syncIdList.length - localIdMap.size;
  }
  // The server's content, in this phone's terms now that those ingredients are here.
  tx.update(recipes)
    .set({ syncedContent: JSON.stringify(remoteContent(tx, row, title)) })
    .where(eq(recipes.id, local.id))
    .run();
  return linkIngredients(tx, local.id, row);
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

// This phone's recipe, in the terms of SyncedContent.
function localContent(tx: AppDatabase, recipeId: number): SyncedContent | undefined {
  const recipe = tx
    .select({
      cookMinutes: recipes.cookMinutes,
      course: recipes.course,
      instructions: recipes.instructions,
      kind: recipes.kind,
      maturationMonths: recipes.maturationMonths,
      prepMinutes: recipes.prepMinutes,
      season: recipes.season,
      title: recipes.title,
    })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .get();
  if (!recipe) {
    return undefined;
  }
  const linkList = tx
    .select({
      amount: recipeIngredients.amount,
      syncId: ingredients.syncId,
      unit: recipeIngredients.unit,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
    .where(eq(recipeIngredients.recipeId, recipeId))
    .all();
  return {
    ...recipe,
    ingredients: Object.fromEntries(
      linkList.map(({ amount, syncId, unit }) => [syncId, toQuantity(amount, unit) ?? null]),
    ),
  };
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

// markOnServer for a recipe, which also keeps the server's content (`synced_content`).
function markRecipeOnServer(
  tx: AppDatabase,
  local:
    | Readonly<{
        id: number;
        serverVersion: null | number;
        syncedContent: null | string;
        updatedAt: number;
      }>
    | undefined,
  row: ServerRecipe,
  title: string,
): void {
  if (
    local?.updatedAt === row.modified &&
    (local.serverVersion !== row.modified || local.syncedContent === null)
  ) {
    tx.update(recipes)
      .set({
        serverVersion: row.modified,
        syncedContent: JSON.stringify(remoteContent(tx, row, title)),
      })
      .where(eq(recipes.id, local.id))
      .run();
  }
}

// Changed here and on the server since they last agreed (and not deleted here meanwhile): their
// changes are merged (mergeRecipe), from what both started from. Returns how many of its
// ingredients aren't here (yet); undefined when there's nothing to merge, or what both started from
// isn't known (the newest change then wins, whole).
function mergeIfChangedOnBothSides(
  tx: AppDatabase,
  local:
    | (Parameters<typeof mergeRecipe>[1]['local'] &
        Readonly<{ serverVersion: null | number; syncedContent: null | string }>)
    | undefined,
  row: ServerRecipe,
  title: string,
): number | undefined {
  if (!local || !isChangedOnBothSides(local, row) || isDeletedHereLater(tx, 'recipes', row)) {
    return undefined;
  }
  const base = parseSyncedContent(local.syncedContent);
  return base && mergeRecipe(tx, { base, local, row, title });
}

// The pulled version of the recipe, the phone's version and what both started from, merged field by
// field (mergeContent). The result is pushed back by this sync, unless it's the server's version
// (the phone's changes were already there).
function mergeRecipe(
  tx: AppDatabase,
  {
    base,
    local,
    row,
    title,
  }: Readonly<{
    base: SyncedContent;
    local: Readonly<{
      createdBy: null | string;
      id: number;
      photoFile: null | string;
      photoSynced: null | string;
      updatedAt: number;
    }>;
    row: ServerRecipe;
    title: string;
  }>,
): number {
  const remote = remoteContent(tx, row, title);
  const here = localContent(tx, local.id);
  if (!here) {
    return 0;
  }
  // Ingredients the phone doesn't have (not pulled yet) are left as they were: it can't have
  // removed them.
  const unlinkedList = Object.keys(base.ingredients).filter(
    (syncId) => !Object.hasOwn(here.ingredients, syncId),
  );
  const localIdMap = localIngredientIds(tx, unlinkedList);
  const notHereList = unlinkedList
    .filter((syncId) => !localIdMap.has(syncId))
    .map((syncId): [string, null | Quantity] => [syncId, base.ingredients[syncId] ?? null]);
  const merged = mergeContent(
    base,
    { ...here, ingredients: { ...here.ingredients, ...Object.fromEntries(notHereList) } },
    remote,
    local.updatedAt > row.modified,
  );
  const claimed = claimTitle(tx, merged.title, row.id);
  const isServerVersion = !claimed.isRenamed && isSameContent(merged, remote);
  tx.update(recipes)
    .set({
      cookMinutes: merged.cookMinutes,
      course: merged.course,
      createdBy: pulledAuthor(row, local),
      instructions: merged.instructions,
      kind: merged.kind,
      maturationMonths: merged.maturationMonths,
      prepMinutes: merged.prepMinutes,
      season: merged.season,
      serverVersion: row.modified,
      sortKey: toSortKey(claimed.title),
      syncedContent: JSON.stringify(remote),
      title: claimed.title,
      // Newer than both: the server takes the merged version from this phone.
      updatedAt: isServerVersion ? row.modified : Math.max(local.updatedAt, row.modified) + 1,
      ...(!isLocalPhotoChanged(local) && pulledPhoto(row, local)),
    })
    .where(eq(recipes.id, local.id))
    .run();
  return linkIngredients(tx, local.id, {
    ingredients: Object.keys(merged.ingredients),
    quantities: merged.ingredients,
  });
}

// The title with the first number no other recipe than `syncId` has: "crêpes (2)", "crêpes (3)"…
function numberedTitle(tx: AppDatabase, title: string, syncId: string): string {
  let number = 2;
  while (otherRecipeTitled(tx, `${title} (${number})`, syncId)) {
    number += 1;
  }
  return `${title} (${number})`;
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

// The other recipe here (not `syncId`) with this title, ignoring case and accents, if any.
function otherRecipeTitled(tx: AppDatabase, title: string, syncId: string) {
  const sortKey = toSortKey(title);
  return tx
    .select({ id: recipes.id, syncId: recipes.syncId, title: recipes.title })
    .from(recipes)
    .where(and(eq(recipes.sortKey, sortKey), ne(recipes.syncId, syncId)))
    .get();
}

// The own sync ids of these ingredients, by id.
function ownSyncIds(tx: AppDatabase, idList: readonly number[]): Map<number, string> {
  if (idList.length === 0) {
    return new Map();
  }
  const rowList = tx
    .select({ id: ingredients.id, syncId: ingredients.syncId })
    .from(ingredients)
    .where(inArray(ingredients.id, [...idList]))
    .all();
  return new Map(rowList.map(({ id, syncId }) => [id, syncId]));
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

// A pulled recipe in the terms of SyncedContent: its ingredients by this phone's sync id for them
// when it has them (its own, or the one an alias names), else by the server's.
function remoteContent(tx: AppDatabase, row: ServerRecipe, title: string): SyncedContent {
  const syncIdList = ingredientSyncIdsOf(row);
  const localIdMap = localIngredientIds(tx, syncIdList);
  const ownSyncIdMap = ownSyncIds(tx, [...localIdMap.values()]);
  const ingredientMap: Record<string, null | Quantity> = {};
  for (const syncId of syncIdList) {
    const localId = localIdMap.get(syncId);
    const key = (localId === undefined ? undefined : ownSyncIdMap.get(localId)) ?? syncId;
    // The first sync id naming an ingredient, as linkIngredients.
    if (!Object.hasOwn(ingredientMap, key)) {
      ingredientMap[key] = pulledQuantity(row.quantities, syncId) ?? null;
    }
  }
  return {
    course: toCourse(row.course),
    ingredients: ingredientMap,
    instructions: typeof row.instructions === 'string' ? row.instructions.trim() : '',
    kind: toRecipeKind(row.kind),
    ...pulledTimes(row),
    season: toSeason(row.season),
    title,
  };
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

// A pulled recipe's kind: a dish unless it says drink (empty on a server from before drinks).
function toRecipeKind(value: unknown): RecipeKind {
  return value === 'drink' ? 'drink' : 'dish';
}

function toSeason(value: string): Season {
  return SEASON_LIST.includes(value as Season) ? (value as Season) : 'both';
}
