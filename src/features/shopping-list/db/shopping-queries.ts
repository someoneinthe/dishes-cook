import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Unit } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { ingredients, recipeIngredients, recipes } from '@/db/schema';
import { toDisplayName } from '@/lib/text';

// The shopping list of the picked meals (see docs/database.md): their ingredients, each quantity
// added up in SQL. Quantities are stored normalized (grams, millilitres; spoons and counted units as
// written), so the amounts of one unit add up directly.

export type PickedMeal = Readonly<{ id: number; title: string }>;

// An ingredient of the list in one unit: "leek, 3" (pieces) and "leek, 300 g" are two lines.
export type ShoppingLine = Readonly<{
  // The total, or undefined when none of the meals gives a quantity ("salt").
  amount?: number;
  ingredientId: number;
  name: string;
  unit?: Unit;
}>;

// At most this many lines (50 meals of 20 ingredients each): the query stays bounded.
const MAX_LINES = 1000;

// The picked meals that still exist (one may have been deleted since), by title.
export function listPickedMeals(
  database: AppDatabase,
  recipeIdList: readonly number[],
): PickedMeal[] {
  return recipeIdList.length === 0
    ? []
    : database
        .select({ id: recipes.id, title: recipes.title })
        .from(recipes)
        .where(inArray(recipes.id, [...recipeIdList]))
        .orderBy(asc(recipes.sortKey), asc(recipes.id))
        .all()
        .map((meal) => ({ ...meal, title: toDisplayName(meal.title) }));
}

// The ingredients of the meals, by name, one line per unit, the amounts added up. Plan: the links
// of the meals from the (recipe_id, ingredient_id) primary key, each ingredient by primary key,
// grouped and sorted (a few hundred rows at most).
export function listShoppingLines(
  database: AppDatabase,
  recipeIdList: readonly number[],
): ShoppingLine[] {
  if (recipeIdList.length === 0) {
    return [];
  }
  return database
    .select({
      amount: sql<null | number>`sum(${recipeIngredients.amount})`,
      ingredientId: ingredients.id,
      name: ingredients.name,
      unit: recipeIngredients.unit,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
    .where(inArray(recipeIngredients.recipeId, [...recipeIdList]))
    .groupBy(ingredients.id, recipeIngredients.unit)
    .orderBy(asc(ingredients.sortKey), asc(ingredients.id), asc(recipeIngredients.unit))
    .limit(MAX_LINES)
    .all()
    .map(({ amount, ingredientId, name, unit }) => ({
      ingredientId,
      name: toDisplayName(name),
      ...(amount !== null && amount > 0 && { amount }),
      ...(unit !== null && { unit }),
    }));
}
