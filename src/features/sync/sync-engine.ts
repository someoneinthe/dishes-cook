import { and, asc, eq, gt, inArray, ne, or, sql } from 'drizzle-orm';
import type { Course, Season, SyncedTable } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { PAGE_SIZE } from '@/db/pagination';
import {
  COURSE_LIST,
  ingredients,
  NOW_MS,
  recipeIngredients,
  recipes,
  SEASON_LIST,
  syncDeletions,
} from '@/db/schema';
import { isSyncId } from '@/lib/sync-id';
import { cleanName, toNameKey, toSortKey } from '@/lib/text';
import type { ServerIngredient, ServerRecipe, ServerRow, ServerRowOf, SyncApi } from './sync-api';

// Two-way sync between the phone's database and the sync server (see docs/sync.md):
// 1. pull the rows written on the server since the last pull, and apply the newer ones;
// 2. push the deletions, then the rows changed here since the last push.
// The newest change of a row wins (`updated_at` here, `modified` there). Applying a pulled row
// keeps its `modified` as `updated_at`, so it isn't pushed back.

export type SyncCursors = Readonly<{
  // Server time of the last row pulled ('' = never pulled: everything).
  pulledUntil: string;
  // Rows changed here at or after this time (ms) are pushed (0 = everything: the first sync merges).
  pushedFrom: number;
}>;

export const INITIAL_CURSORS: SyncCursors = { pulledUntil: '', pushedFrom: 0 };

type PushCursor = Readonly<{ id: number; updatedAt: number }>;

export async function synchronize(
  database: AppDatabase,
  api: SyncApi,
  cursors: SyncCursors,
  now: () => number = Date.now,
): Promise<SyncCursors> {
  // Changes made from now on, even during this sync, are pushed next time.
  const startedAt = now();
  // Ingredients first: pulled recipes link to them.
  const ingredientsPulledUntil = await pull(api, 'ingredients', cursors.pulledUntil, (rowList) =>
    applyIngredients(database, rowList),
  );
  const recipesPulledUntil = await pull(api, 'recipes', cursors.pulledUntil, (rowList) =>
    applyRecipes(database, rowList),
  );
  await pushDeletions(database, api);
  await pushIngredients(database, api, cursors.pushedFrom);
  await pushRecipes(database, api, cursors.pushedFrom);
  return {
    pulledUntil: latest(ingredientsPulledUntil, recipesPulledUntil),
    pushedFrom: startedAt,
  };
}

function applyIngredient(tx: AppDatabase, row: ServerIngredient): void {
  const name = cleanName(typeof row.name === 'string' ? row.name : '');
  if (!name || !isValidRow(row)) {
    return;
  }
  const local = tx
    .select({ id: ingredients.id, updatedAt: ingredients.updatedAt })
    .from(ingredients)
    .where(eq(ingredients.syncId, row.id))
    .get();
  if (!isNewerThan(row, local)) {
    return;
  }
  if (row.deleted > 0) {
    if (local) {
      deletePulledIngredient(tx, local.id);
    }
    return;
  }
  const nameKey = toNameKey(name);
  // Another ingredient here already has this name (renamed on another phone): ours is kept.
  if (
    isDeletedHereLater(tx, 'ingredients', row) ||
    hasOtherIngredientNamed(tx, nameKey, local?.id)
  ) {
    return;
  }
  const values = { name, nameKey, sortKey: toSortKey(name), updatedAt: row.modified };
  if (local) {
    tx.update(ingredients).set(values).where(eq(ingredients.id, local.id)).run();
  } else {
    tx.insert(ingredients)
      .values({ ...values, syncId: row.id })
      .run();
    forgetDeletion(tx, 'ingredients', row.id);
  }
}

function applyIngredients(database: AppDatabase, rowList: readonly ServerIngredient[]): void {
  database.transaction((tx) => {
    for (const row of rowList) {
      applyIngredient(tx, row);
    }
  });
}

function applyRecipe(tx: AppDatabase, row: ServerRecipe): void {
  const title = cleanName(typeof row.title === 'string' ? row.title : '');
  if (!title || !isValidRow(row)) {
    return;
  }
  const local = tx
    .select({ id: recipes.id, updatedAt: recipes.updatedAt })
    .from(recipes)
    .where(eq(recipes.syncId, row.id))
    .get();
  if (!isNewerThan(row, local)) {
    return;
  }
  if (row.deleted > 0) {
    if (local) {
      // Its links go with it (ON DELETE CASCADE). No deletion kept: the server has it.
      tx.delete(recipes).where(eq(recipes.id, local.id)).run();
    }
    return;
  }
  if (isDeletedHereLater(tx, 'recipes', row)) {
    return;
  }
  const values = {
    course: toCourse(row.course),
    instructions: typeof row.instructions === 'string' ? row.instructions.trim() : '',
    season: toSeason(row.season),
    sortKey: toSortKey(title),
    title,
    updatedAt: row.modified,
  };
  if (local) {
    tx.update(recipes).set(values).where(eq(recipes.id, local.id)).run();
    linkIngredients(tx, local.id, row.ingredients);
    return;
  }
  const { id } = tx
    .insert(recipes)
    .values({ ...values, syncId: row.id })
    .returning({ id: recipes.id })
    .get();
  forgetDeletion(tx, 'recipes', row.id);
  linkIngredients(tx, id, row.ingredients);
}

function applyRecipes(database: AppDatabase, rowList: readonly ServerRecipe[]): void {
  database.transaction((tx) => {
    for (const row of rowList) {
      applyRecipe(tx, row);
    }
  });
}

// Rows changed at or after `pushedFrom`, after the keyset cursor (the last row of the previous
// page), in (updated_at, id) order: the order of the *_updated_at_id_idx indexes.
function changedSince(
  table: typeof ingredients | typeof recipes,
  pushedFrom: number,
  cursor: PushCursor | undefined,
) {
  const since = sql`${table.updatedAt} >= ${pushedFrom}`;
  if (!cursor) {
    return since;
  }
  const sameTimeLaterId = and(eq(table.updatedAt, cursor.updatedAt), gt(table.id, cursor.id));
  return and(since, or(gt(table.updatedAt, cursor.updatedAt), sameTimeLaterId));
}

// Deleted on another phone. Still used by a recipe here (added since): kept, and pushed again.
function deletePulledIngredient(tx: AppDatabase, id: number): void {
  const link = tx
    .select({ recipeId: recipeIngredients.recipeId })
    .from(recipeIngredients)
    .where(eq(recipeIngredients.ingredientId, id))
    .limit(1)
    .get();
  if (link) {
    tx.update(ingredients).set({ updatedAt: NOW_MS }).where(eq(ingredients.id, id)).run();
  } else {
    tx.delete(ingredients).where(eq(ingredients.id, id)).run();
  }
}

function forgetDeletion(tx: AppDatabase, tableName: 'ingredients' | 'recipes', syncId: string) {
  tx.delete(syncDeletions)
    .where(and(eq(syncDeletions.tableName, tableName), eq(syncDeletions.syncId, syncId)))
    .run();
}

function hasOtherIngredientNamed(tx: AppDatabase, nameKey: string, id: number | undefined) {
  const sameName = tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      id === undefined
        ? eq(ingredients.nameKey, nameKey)
        : and(eq(ingredients.nameKey, nameKey), ne(ingredients.id, id)),
    )
    .get();
  return sameName !== undefined;
}

// Deleted here after the server's change: the deletion is pushed by this sync.
function isDeletedHereLater(
  tx: AppDatabase,
  tableName: 'ingredients' | 'recipes',
  row: ServerRow,
): boolean {
  const deletion = tx
    .select({ deletedAt: syncDeletions.deletedAt })
    .from(syncDeletions)
    .where(and(eq(syncDeletions.tableName, tableName), eq(syncDeletions.syncId, row.id)))
    .get();
  return deletion !== undefined && deletion.deletedAt >= row.modified;
}

// No row here, or an older one. Equal times are the same change (pulled before, or pushed by us).
function isNewerThan(row: ServerRow, local: Readonly<{ updatedAt: number }> | undefined) {
  return local === undefined || row.modified > local.updatedAt;
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

// Replaces the recipe's ingredients with the pulled ones; those not here (yet) are left out.
function linkIngredients(tx: AppDatabase, recipeId: number, pulledSyncIds: unknown): void {
  tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId)).run();
  const syncIdList = Array.isArray(pulledSyncIds)
    ? pulledSyncIds.filter((syncId) => isSyncId(syncId))
    : [];
  if (syncIdList.length === 0) {
    return;
  }
  const ingredientList = tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(inArray(ingredients.syncId, syncIdList))
    .all();
  if (ingredientList.length > 0) {
    tx.insert(recipeIngredients)
      .values(ingredientList.map((ingredient) => ({ ingredientId: ingredient.id, recipeId })))
      .run();
  }
}

// Pages through the rows written on the server since `since`; returns the last one's time.
async function pull<Table extends SyncedTable>(
  api: SyncApi,
  table: Table,
  since: string,
  apply: (rowList: readonly ServerRowOf<Table>[]) => void,
): Promise<string> {
  let pulledUntil = since;
  for (let page = 1; ; page++) {
    const rowList = await api.listChanges(table, since, page);
    apply(rowList);
    pulledUntil = latest(pulledUntil, rowList.at(-1)?.updated);
    if (rowList.length < PAGE_SIZE) {
      return pulledUntil;
    }
  }
}

async function pushDeletions(database: AppDatabase, api: SyncApi): Promise<void> {
  for (;;) {
    const deletionList = database
      .select()
      .from(syncDeletions)
      .orderBy(asc(syncDeletions.deletedAt))
      .limit(PAGE_SIZE)
      .all();
    // A page's rows are independent: sent together. Each deletion is forgotten once sent; when
    // it's missing on the server (never pushed) or changed there later, there's nothing more to tell.
    await Promise.all(
      deletionList.map(async (deletion) => {
        await api.sendDeletion(deletion.tableName, deletion.syncId, deletion.deletedAt);
        forgetDeletion(database, deletion.tableName, deletion.syncId);
      }),
    );
    if (deletionList.length < PAGE_SIZE) {
      return;
    }
  }
}

async function pushIngredients(
  database: AppDatabase,
  api: SyncApi,
  pushedFrom: number,
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
      .where(changedSince(ingredients, pushedFrom, cursor))
      .orderBy(asc(ingredients.updatedAt), asc(ingredients.id))
      .limit(PAGE_SIZE)
      .all();
    await Promise.all(
      rowList.map((row) =>
        api.upsert('ingredients', row.syncId, {
          deleted: 0,
          modified: row.updatedAt,
          name: row.name,
        }),
      ),
    );
    cursor = rowList.at(-1);
    if (rowList.length < PAGE_SIZE) {
      return;
    }
  }
}

async function pushRecipes(database: AppDatabase, api: SyncApi, pushedFrom: number): Promise<void> {
  let cursor: PushCursor | undefined;
  for (;;) {
    const rowList = database
      .select({
        course: recipes.course,
        id: recipes.id,
        instructions: recipes.instructions,
        season: recipes.season,
        syncId: recipes.syncId,
        title: recipes.title,
        updatedAt: recipes.updatedAt,
      })
      .from(recipes)
      .where(changedSince(recipes, pushedFrom, cursor))
      .orderBy(asc(recipes.updatedAt), asc(recipes.id))
      .limit(PAGE_SIZE)
      .all();
    // The page's ingredient links in one query, grouped by recipe.
    const linkList =
      rowList.length === 0
        ? []
        : database
            .select({ recipeId: recipeIngredients.recipeId, syncId: ingredients.syncId })
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
    for (const link of linkList) {
      const syncIdList = ingredientSyncIdsByRecipe.get(link.recipeId) ?? [];
      syncIdList.push(link.syncId);
      ingredientSyncIdsByRecipe.set(link.recipeId, syncIdList);
    }
    await Promise.all(
      rowList.map((row) =>
        api.upsert('recipes', row.syncId, {
          course: row.course,
          deleted: 0,
          ingredients: ingredientSyncIdsByRecipe.get(row.id) ?? [],
          instructions: row.instructions,
          modified: row.updatedAt,
          season: row.season,
          title: row.title,
        }),
      ),
    );
    cursor = rowList.at(-1);
    if (rowList.length < PAGE_SIZE) {
      return;
    }
  }
}

function toCourse(value: string): Course {
  return COURSE_LIST.includes(value as Course) ? (value as Course) : 'main';
}

function toSeason(value: string): Season {
  return SEASON_LIST.includes(value as Season) ? (value as Season) : 'both';
}
