import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, inArray, ne, notInArray, or, sql } from 'drizzle-orm';
import type { Page, PageRequest } from '@/db/pagination';
import type { AppDatabase } from '@/db/types';
import { isBackward, keysetWhere, PAGE_SIZE, toPage } from '@/db/pagination';
import { ingredients, NOW_MS, recipeIngredients, syncDeletions } from '@/db/schema';
import { toIngredientSyncId } from '@/lib/sync-id';
import {
  cleanName,
  toDisplayName,
  toLikeContains,
  toNameKey,
  toSortKey,
  toWordForms,
} from '@/lib/text';

export type DeleteResult = 'deleted' | 'in-use';

export type Ingredient = Readonly<{ id: number; name: string }>;

export type IngredientListItem = Ingredient & Readonly<{ recipeCount: number; sortKey: string }>;

export type RenameResult = 'blank' | 'duplicate' | 'renamed';

// Separators between words of a name, for whole-word comparisons ("Sel, poivre" = "sel poivre");
// apostrophes stay, all written ' ("d’agneau" = "d'agneau").
const NOT_A_WORD = /[^\p{L}\p{N}']+/gu;
const CURLY_APOSTROPHE = '’';

// Number of recipes using the ingredient, read from the (ingredient_id, recipe_id) index. Written
// out qualified: Drizzle renders `${ingredients.id}` as a bare "id" inside a select.
const RECIPE_COUNT = sql<number>`(select count(*) from "recipe_ingredients" where "recipe_ingredients"."ingredient_id" = "ingredients"."id")`;

// Deletes an unused ingredient. The foreign key is ON DELETE RESTRICT, so usage is checked first
// instead of catching a driver-specific error. The deletion is kept for the sync server.
export function deleteIngredient(database: AppDatabase, id: number): DeleteResult {
  return database.transaction((tx) => {
    const link = tx
      .select({ recipeId: recipeIngredients.recipeId })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.ingredientId, id))
      .limit(1)
      .get();
    if (link) {
      return 'in-use';
    }
    const deleted = tx
      .delete(ingredients)
      .where(eq(ingredients.id, id))
      .returning({ syncId: ingredients.syncId })
      .get();
    if (deleted) {
      tx.insert(syncDeletions)
        .values({ syncId: deleted.syncId, tableName: 'ingredients' })
        .onConflictDoUpdate({
          set: { deletedAt: NOW_MS },
          target: [syncDeletions.tableName, syncDeletions.syncId],
        })
        .run();
    }
    return 'deleted';
  });
}

export function findIngredientByName(database: AppDatabase, name: string): Ingredient | undefined {
  const found = database
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(eq(ingredients.nameKey, toNameKey(name)))
    .get();
  return found && shown(found);
}

// Returns the ingredient with this name, creating it if needed (names are unique, ignoring case).
// One statement when it's new: the unique index on name_key resolves the race-free upsert.
export function findOrCreateIngredient(
  database: AppDatabase,
  name: string,
): Ingredient & Readonly<{ isNew: boolean }> {
  const cleanedName = cleanName(name);
  if (!cleanedName) {
    throw new Error('An ingredient name cannot be blank');
  }
  const nameKey = toNameKey(cleanedName);
  const created = database
    .insert(ingredients)
    .values({
      name: nameKey,
      nameKey,
      sortKey: toSortKey(cleanedName),
      syncId: toIngredientSyncId(nameKey),
    })
    .onConflictDoNothing({ target: ingredients.nameKey })
    .returning({ id: ingredients.id, name: ingredients.name })
    .get();
  if (created) {
    return { ...shown(created), isNew: true };
  }
  const existing = findIngredientByName(database, cleanedName);
  if (!existing) {
    throw new Error(`Ingredient "${cleanedName}" could not be created`);
  }
  return { ...existing, isNew: false };
}

// An ingredient written another way than this name, but likely the same one: with other accents
// or in the other number ("carrot" for "carrots", "Poireau" for "poireaux"), else one whose name is
// in this one as whole words ("vin rouge" in "bouteille de vin rouge", "Sel" in "Sel, poivre"):
// the most used one, the longest name for words.
// Plan: a lookup per word form on the (sort_key, id) index; for words, a scan of the ingredients
// (a household's list), each compared with the name's forms, LIMIT 1.
export function findSimilarIngredient(database: AppDatabase, name: string): Ingredient | undefined {
  const formList = toWordForms(name);
  const otherNameWhere = ne(ingredients.nameKey, toNameKey(name));
  const sameForm = database
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(and(inArray(ingredients.sortKey, formList), otherNameWhere))
    .orderBy(desc(RECIPE_COUNT), asc(ingredients.sortKey))
    .limit(1)
    .get();
  if (sameForm) {
    return shown(sameForm);
  }
  // ' vin rouge ' inside ' bouteille de vin rouge assez bon ': whole words only.
  const paddedList = formList.map(
    (form) => ` ${form.replaceAll(CURLY_APOSTROPHE, "'").replaceAll(NOT_A_WORD, ' ').trim()} `,
  );
  // The stored key with its apostrophes written ' too.
  const storedKey = sql`replace(${ingredients.sortKey}, ${CURLY_APOSTROPHE}, '''')`;
  const inNameWhere = or(
    ...paddedList.map((padded) => sql`instr(${padded}, ' ' || ${storedKey} || ' ') > 0`),
  );
  const inName = database
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(and(inNameWhere, otherNameWhere))
    .orderBy(
      desc(sql`length(${ingredients.sortKey})`),
      desc(RECIPE_COUNT),
      asc(ingredients.sortKey),
    )
    .limit(1)
    .get();
  return inName && shown(inName);
}

// One page (PAGE_SIZE) of the alphabetical ingredient list with usage counts, optionally filtered
// by a search (accent- and case-insensitive "contains").
// Plan: walk the (sort_key, id) index from the cursor, count links on the ingredient index.
export function listIngredientPage(
  database: AppDatabase,
  options: Readonly<{ pageParam: PageRequest; search: string }>,
): Page<IngredientListItem> {
  const { pageParam, search } = options;
  const order = isBackward(pageParam) ? desc : asc;
  const rowList = database
    .select({
      id: ingredients.id,
      name: ingredients.name,
      recipeCount: RECIPE_COUNT,
      sortKey: ingredients.sortKey,
    })
    .from(ingredients)
    .where(and(searchWhere(search), keysetWhere(ingredients, pageParam)))
    .orderBy(order(ingredients.sortKey), order(ingredients.id))
    .limit(PAGE_SIZE + 1)
    .all();
  return toPage(
    rowList.map((row) => shown(row)),
    pageParam,
  );
}

export function renameIngredient(database: AppDatabase, id: number, name: string): RenameResult {
  const cleanedName = cleanName(name);
  if (!cleanedName) {
    return 'blank';
  }
  const nameKey = toNameKey(cleanedName);
  const duplicate = database
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(and(eq(ingredients.nameKey, nameKey), ne(ingredients.id, id)))
    .get();
  if (duplicate) {
    return 'duplicate';
  }
  database
    .update(ingredients)
    .set({ name: nameKey, nameKey, sortKey: toSortKey(cleanedName), updatedAt: NOW_MS })
    .where(eq(ingredients.id, id))
    .run();
  return 'renamed';
}

// A few ingredients to pick from: the exact name first, then the most used, then alphabetical.
export function suggestIngredients(
  database: AppDatabase,
  options: Readonly<{
    excludeIdList: readonly number[];
    // Only ingredients some recipe uses (to filter recipes by them).
    isUsedOnly: boolean;
    limit: number;
    search: string;
  }>,
): Ingredient[] {
  const { excludeIdList, isUsedOnly, limit, search } = options;
  const searchedNameKey = toNameKey(search);
  const rowList = database
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(
      and(
        searchWhere(search),
        excludeIdList.length > 0 ? notInArray(ingredients.id, [...excludeIdList]) : undefined,
        isUsedOnly ? sql`${RECIPE_COUNT} > 0` : undefined,
      ),
    )
    .orderBy(
      desc(eq(ingredients.nameKey, searchedNameKey)),
      desc(RECIPE_COUNT),
      asc(ingredients.sortKey),
    )
    .limit(limit)
    .all();
  return rowList.map((row) => shown(row));
}

function searchWhere(search: string): SQL | undefined {
  return cleanName(search)
    ? sql`${ingredients.sortKey} like ${toLikeContains(search)} escape '\\'`
    : undefined;
}

// A row with its name as shown (saved in lowercase).
function shown<Row extends Readonly<{ name: string }>>(row: Row): Row {
  return { ...row, name: toDisplayName(row.name) };
}
