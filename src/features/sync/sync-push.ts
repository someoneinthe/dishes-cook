import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/db/types';
import type { Quantity } from '@/lib/units';
import { PAGE_SIZE } from '@/db/pagination';
import { cookedMeals, ingredients, recipeIngredients, recipes, syncDeletions } from '@/db/schema';
import { toQuantity } from '@/lib/units';
import type { SyncApi, UpsertResult } from './sync-api';
import type { SyncedTableSchema } from './sync-shared';
import { isServerPhotoKept } from './sync-photos';
import { forgetDeletion, notOnServer, throwFirstFailure } from './sync-shared';

// The push half of the sync (sync-engine.ts): the deletions made here, then the rows the server
// doesn't have in their current version (see docs/sync.md).

type PushCursor = Readonly<{ id: number; updatedAt: number }>;

export async function pushCookedMeals(
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

export async function pushDeletions(
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

export async function pushIngredients(
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

export async function pushRecipes(
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
