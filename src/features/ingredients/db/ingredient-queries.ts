import { and, count, eq, ne } from 'drizzle-orm';
import type { AppDatabase } from '@/db/types';
import { ingredients, recipeIngredients } from '@/db/schema';
import { cleanName, sortByText, toNameKey } from '@/lib/text';

export type DeleteResult = 'deleted' | 'in-use';

export type Ingredient = Readonly<{ id: number; name: string }>;

export type IngredientListItem = Ingredient & Readonly<{ recipeCount: number }>;

export type RenameResult = 'blank' | 'duplicate' | 'renamed';

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
    .values({ name: cleanedName, nameKey: toNameKey(cleanedName) })
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

// Every ingredient with the number of recipes using it, sorted by name.
// Plan: scan ingredients, then count each one's links on the (ingredient_id, recipe_id) index.
export function listIngredients(database: AppDatabase): IngredientListItem[] {
  const rowList = database
    .select({
      id: ingredients.id,
      name: ingredients.name,
      recipeCount: count(recipeIngredients.recipeId),
    })
    .from(ingredients)
    .leftJoin(recipeIngredients, eq(recipeIngredients.ingredientId, ingredients.id))
    .groupBy(ingredients.id)
    .all();
  // Sorted in JS: SQLite can't collate accents ("Échalote" would come after "zucchini").
  return sortByText(rowList, (row) => row.name);
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
    .set({ name: cleanedName, nameKey })
    .where(eq(ingredients.id, id))
    .run();
  return 'renamed';
}
