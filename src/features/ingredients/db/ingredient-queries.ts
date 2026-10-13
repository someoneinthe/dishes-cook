import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, ne, notInArray, sql } from 'drizzle-orm';
import type { Page, PageRequest } from '@/db/pagination';
import type { AppDatabase } from '@/db/types';
import { isBackward, keysetWhere, PAGE_SIZE, toPage } from '@/db/pagination';
import { ingredients, recipeIngredients } from '@/db/schema';
import { cleanName, toLikeContains, toNameKey, toSortKey } from '@/lib/text';

export type DeleteResult = 'deleted' | 'in-use';

export type Ingredient = Readonly<{ id: number; name: string }>;

export type IngredientListItem = Ingredient & Readonly<{ recipeCount: number; sortKey: string }>;

export type RenameResult = 'blank' | 'duplicate' | 'renamed';

// Number of recipes using the ingredient, read from the (ingredient_id, recipe_id) index. Written
// out qualified: Drizzle renders `${ingredients.id}` as a bare "id" inside a select.
const RECIPE_COUNT = sql<number>`(select count(*) from "recipe_ingredients" where "recipe_ingredients"."ingredient_id" = "ingredients"."id")`;

// Deletes an unused ingredient. The foreign key is ON DELETE RESTRICT, so usage is checked first
// instead of catching a driver-specific error.
export function deleteIngredient(database: AppDatabase, id: number): DeleteResult {
  const link = database
    .select({ recipeId: recipeIngredients.recipeId })
    .from(recipeIngredients)
    .where(eq(recipeIngredients.ingredientId, id))
    .limit(1)
    .get();
  if (link) {
    return 'in-use';
  }
  database.delete(ingredients).where(eq(ingredients.id, id)).run();
  return 'deleted';
}

export function findIngredientByName(database: AppDatabase, name: string): Ingredient | undefined {
  return database
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(eq(ingredients.nameKey, toNameKey(name)))
    .get();
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
  const created = database
    .insert(ingredients)
    .values({ name: cleanedName, nameKey: toNameKey(cleanedName), sortKey: toSortKey(cleanedName) })
    .onConflictDoNothing({ target: ingredients.nameKey })
    .returning({ id: ingredients.id, name: ingredients.name })
    .get();
  if (created) {
    return { ...created, isNew: true };
  }
  const existing = findIngredientByName(database, cleanedName);
  if (!existing) {
    throw new Error(`Ingredient "${cleanedName}" could not be created`);
  }
  return { ...existing, isNew: false };
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
  return toPage(rowList, pageParam);
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
    .set({ name: cleanedName, nameKey, sortKey: toSortKey(cleanedName) })
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
  return database
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
}

function searchWhere(search: string): SQL | undefined {
  return cleanName(search)
    ? sql`${ingredients.sortKey} like ${toLikeContains(search)} escape '\\'`
    : undefined;
}
