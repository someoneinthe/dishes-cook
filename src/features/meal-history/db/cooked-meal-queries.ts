import type { SQL } from 'drizzle-orm';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/db/types';
import { cookedMeals, NOW_MS, recipes, syncDeletions } from '@/db/schema';

// The meal history (see docs/database.md): one row each time a recipe is cooked.

export type CookedMeal = Readonly<{ cookedAt: number; id: number }>;

// The last time the recipe was cooked; undefined if it never was. Reads one entry of the
// (recipe_id, cooked_at) index, from its end.
export function getLastCookedMeal(database: AppDatabase, recipeId: number): CookedMeal | undefined {
  return database
    .select({ cookedAt: cookedMeals.cookedAt, id: cookedMeals.id })
    .from(cookedMeals)
    .where(eq(cookedMeals.recipeId, recipeId))
    .orderBy(desc(cookedMeals.cookedAt), desc(cookedMeals.id))
    .limit(1)
    .get();
}

// Records that these recipes were all cooked now (the meals of a shopping list), in one go. Drinks
// on the list are left out: they have no meal history.
export function markAllCooked(database: AppDatabase, recipeIdList: readonly number[]): void {
  if (recipeIdList.length === 0) {
    return;
  }
  const dishIdList = database
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(inArray(recipes.id, [...recipeIdList]), eq(recipes.kind, 'dish')))
    .all();
  if (dishIdList.length === 0) {
    return;
  }
  database
    .insert(cookedMeals)
    .values(dishIdList.map(({ id }) => ({ recipeId: id })))
    .run();
}

// Records that the recipe was cooked now (`cookedAt` for tests). The recipe itself isn't changed.
export function markCooked(database: AppDatabase, recipeId: number, cookedAt?: number): number {
  return database
    .insert(cookedMeals)
    .values({ cookedAt: cookedAt ?? NOW_MS, recipeId })
    .returning({ id: cookedMeals.id })
    .get().id;
}

// Recipes not cooked at or after `since` (ms), for a recipe query's WHERE: a lookup in the
// (recipe_id, cooked_at) index per recipe. Written out qualified: inside a subquery, Drizzle would
// render `recipes.id` as a bare "id", which is the meal's own.
export function notCookedSinceWhere(since: number): SQL {
  return sql`not exists (select 1 from "cooked_meals" where "cooked_meals"."recipe_id" = "recipes"."id" and "cooked_meals"."cooked_at" >= ${since})`;
}

// The last time each recipe was cooked, for a recipe query's ORDER BY (null: never).
export const LAST_COOKED_AT = sql<
  null | number
>`(select max("cooked_meals"."cooked_at") from "cooked_meals" where "cooked_meals"."recipe_id" = "recipes"."id")`;

// Forgets one time a recipe was cooked. The deletion is kept for the sync server.
export function removeCookedMeal(database: AppDatabase, id: number): void {
  database.transaction((tx) => {
    const deleted = tx
      .delete(cookedMeals)
      .where(eq(cookedMeals.id, id))
      .returning({ syncId: cookedMeals.syncId })
      .get();
    if (deleted) {
      tx.insert(syncDeletions)
        .values({ syncId: deleted.syncId, tableName: 'cooked_meals' })
        .onConflictDoUpdate({
          set: { deletedAt: NOW_MS },
          target: [syncDeletions.tableName, syncDeletions.syncId],
        })
        .run();
    }
  });
}
