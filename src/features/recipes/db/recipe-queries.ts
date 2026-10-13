import type { SQL } from 'drizzle-orm';
import { and, count, eq, inArray, notInArray, sql } from 'drizzle-orm';
import type { Season } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import { ingredients, NOW_MS, recipeIngredients, recipes } from '@/db/schema';
import { cleanName, sortByText } from '@/lib/text';

export type Recipe = Readonly<{
  id: number;
  ingredientList: Ingredient[];
  instructions: string;
  season: Season;
  title: string;
}>;

export type RecipeInput = Readonly<{
  ingredientIdList: readonly number[];
  instructions: string;
  season: Season;
  title: string;
}>;

export type RecipeListItem = Readonly<{
  id: number;
  ingredientCount: number;
  season: Season;
  title: string;
}>;

// Tables read by the queries below, for live queries.
export const RECIPE_TABLES = [recipes, recipeIngredients, ingredients];

export type RecipeFilters = Readonly<{
  // Recipes made with ALL these ingredients.
  ingredientIdList: readonly number[];
  // A season also matches the recipes for both seasons; undefined = any season.
  season?: Exclude<Season, 'both'>;
}>;

// Its ingredient links are deleted by the foreign key's ON DELETE CASCADE.
export function deleteRecipe(database: AppDatabase, id: number): void {
  database.delete(recipes).where(eq(recipes.id, id)).run();
}

// Ids of the recipes matching the filters, for the random pick. Only ids are read: the chosen
// recipe is loaded afterwards. With ingredients, the plan starts from the (ingredient_id,
// recipe_id) index, so only recipes containing a selected ingredient are visited.
export function findRecipeIds(database: AppDatabase, filters: RecipeFilters): number[] {
  const conditionList: SQL[] = [];
  if (filters.season) {
    conditionList.push(inArray(recipes.season, [filters.season, 'both']));
  }
  const ingredientIdList = [...new Set(filters.ingredientIdList)];
  if (ingredientIdList.length > 0) {
    // The primary key forbids duplicate links, so "all of them" = "as many links as ingredients".
    const recipesWithAllIngredients = database
      .select({ recipeId: recipeIngredients.recipeId })
      .from(recipeIngredients)
      .where(inArray(recipeIngredients.ingredientId, ingredientIdList))
      .groupBy(recipeIngredients.recipeId)
      .having(sql`count(*) = ${ingredientIdList.length}`);
    conditionList.push(inArray(recipes.id, recipesWithAllIngredients));
  }
  return database
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(...conditionList))
    .all()
    .map((row) => row.id);
}

export function getRecipe(database: AppDatabase, id: number): Recipe | undefined {
  const recipe = database
    .select({
      id: recipes.id,
      instructions: recipes.instructions,
      season: recipes.season,
      title: recipes.title,
    })
    .from(recipes)
    .where(eq(recipes.id, id))
    .get();
  if (!recipe) {
    return undefined;
  }
  const ingredientList = database
    .select({ id: ingredients.id, name: ingredients.name })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
    .where(eq(recipeIngredients.recipeId, id))
    .all();
  return { ...recipe, ingredientList: sortByText(ingredientList, (ingredient) => ingredient.name) };
}

export function hasAnyRecipe(database: AppDatabase): boolean {
  return database.select({ id: recipes.id }).from(recipes).limit(1).get() !== undefined;
}

// Every recipe for the list screen. `instructions` (possibly long) is left out on purpose, and the
// ingredient count is read from the (recipe_id, ingredient_id) primary key: no N+1 queries.
export function listRecipes(database: AppDatabase): RecipeListItem[] {
  const rowList = database
    .select({
      id: recipes.id,
      ingredientCount: count(recipeIngredients.ingredientId),
      season: recipes.season,
      title: recipes.title,
    })
    .from(recipes)
    .leftJoin(recipeIngredients, eq(recipeIngredients.recipeId, recipes.id))
    .groupBy(recipes.id)
    .all();
  return sortByText(rowList, (row) => row.title);
}

// Creates (no id) or updates a recipe and its ingredients in one transaction; returns its id.
// Only the ingredient links that changed are written.
export function saveRecipe(database: AppDatabase, input: RecipeInput, id?: number): number {
  const title = cleanName(input.title);
  if (!title) {
    throw new Error('A recipe title cannot be blank');
  }
  const values = { instructions: input.instructions.trim(), season: input.season, title };
  const ingredientIdList = [...new Set(input.ingredientIdList)];

  return database.transaction((tx) => {
    const recipeId =
      id === undefined
        ? tx.insert(recipes).values(values).returning({ id: recipes.id }).get().id
        : updateRecipe(tx, id, values);

    tx.delete(recipeIngredients)
      .where(
        and(
          eq(recipeIngredients.recipeId, recipeId),
          notInArray(recipeIngredients.ingredientId, ingredientIdList),
        ),
      )
      .run();
    if (ingredientIdList.length > 0) {
      tx.insert(recipeIngredients)
        .values(ingredientIdList.map((ingredientId) => ({ ingredientId, recipeId })))
        .onConflictDoNothing()
        .run();
    }
    return recipeId;
  });
}

function updateRecipe(
  tx: Pick<AppDatabase, 'update'>,
  id: number,
  values: Readonly<{ instructions: string; season: Season; title: string }>,
): number {
  const updated = tx
    .update(recipes)
    .set({ ...values, updatedAt: NOW_MS })
    .where(eq(recipes.id, id))
    .returning({ id: recipes.id })
    .get();
  if (!updated) {
    throw new Error(`Recipe ${id} does not exist`);
  }
  return updated.id;
}
