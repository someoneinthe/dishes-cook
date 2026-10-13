import { eq } from 'drizzle-orm';
import { toSortKey } from '@/lib/text';
import type { AppDatabase } from './types';
import { ingredients, recipes } from './schema';

// Fills `sort_key` for rows created before the column existed (migration 0001 adds it empty:
// SQLite can't strip accents). Runs at startup; a no-op once every row has its key.
export function backfillSortKeys(database: AppDatabase): void {
  const ingredientList = database
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(eq(ingredients.sortKey, ''))
    .all();
  const recipeList = database
    .select({ id: recipes.id, title: recipes.title })
    .from(recipes)
    .where(eq(recipes.sortKey, ''))
    .all();
  if (ingredientList.length === 0 && recipeList.length === 0) {
    return;
  }
  database.transaction((tx) => {
    for (const { id, name } of ingredientList) {
      tx.update(ingredients)
        .set({ sortKey: toSortKey(name) })
        .where(eq(ingredients.id, id))
        .run();
    }
    for (const { id, title } of recipeList) {
      tx.update(recipes)
        .set({ sortKey: toSortKey(title) })
        .where(eq(recipes.id, id))
        .run();
    }
  });
}
