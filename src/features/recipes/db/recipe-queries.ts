import type { SQL } from 'drizzle-orm';
import { and, asc, count, desc, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import type { Page, PageRequest } from '@/db/pagination';
import type { Course, Season } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import { isBackward, keysetWhere, PAGE_SIZE, toPage } from '@/db/pagination';
import { ingredients, NOW_MS, recipeIngredients, recipes } from '@/db/schema';
import { cleanName, toLikeContains, toSortKey } from '@/lib/text';

export type Recipe = Readonly<{
  course: Course | null;
  id: number;
  ingredientList: Ingredient[];
  instructions: string;
  season: Season;
  title: string;
}>;

export type RecipeFilters = Readonly<{
  // Recipes of this course (not those without one); undefined = any course.
  course?: Course;
  // Recipes made with ALL these ingredients.
  ingredientIdList: readonly number[];
  // Titles containing it, ignoring case and accents; undefined or blank = any title.
  search?: string;
  // A season also matches the recipes for both seasons; undefined = any season.
  season?: Exclude<Season, 'both'>;
}>;

export type RecipeInput = Readonly<{
  // No course when left out.
  course?: Course | null;
  ingredientIdList: readonly number[];
  instructions: string;
  season: Season;
  title: string;
}>;

export type RecipeListItem = Readonly<{
  course: Course | null;
  id: number;
  ingredientCount: number;
  season: Season;
  sortKey: string;
  title: string;
}>;

// Number of ingredients of the recipe, read from the (recipe_id, ingredient_id) primary key.
// Written out qualified: Drizzle renders `${recipes.id}` as a bare "id" inside a select.
const INGREDIENT_COUNT = sql<number>`(select count(*) from "recipe_ingredients" where "recipe_ingredients"."recipe_id" = "recipes"."id")`;

// Number of recipes matching the filters (the recipe list shows it).
export function countRecipes(database: AppDatabase, filters: RecipeFilters): number {
  return (
    database.select({ count: count() }).from(recipes).where(filtersWhere(database, filters)).get()
      ?.count ?? 0
  );
}

// Its ingredient links are deleted by the foreign key's ON DELETE CASCADE.
export function deleteRecipe(database: AppDatabase, id: number): void {
  database.delete(recipes).where(eq(recipes.id, id)).run();
}
export function getRecipe(database: AppDatabase, id: number): Recipe | undefined {
  const recipe = database
    .select({
      course: recipes.course,
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
    .orderBy(asc(ingredients.sortKey), asc(ingredients.id))
    .all();
  // Not paginated: a recipe's own ingredients, bounded by what the form lets you add.
  return { ...recipe, ingredientList };
}

// One page (PAGE_SIZE) of the alphabetical recipe list, narrowed by the filters (title search,
// season, course, ingredients). `instructions` (possibly long) is left out.
// Plan: walk the (sort_key, id) index from the cursor, count links on the primary key.
export function listRecipePage(
  database: AppDatabase,
  options: Readonly<{ filters: RecipeFilters; pageParam: PageRequest }>,
): Page<RecipeListItem> {
  const { filters, pageParam: pageParameter } = options;
  const order = isBackward(pageParameter) ? desc : asc;
  const rowList = database
    .select({
      course: recipes.course,
      id: recipes.id,
      ingredientCount: INGREDIENT_COUNT,
      season: recipes.season,
      sortKey: recipes.sortKey,
      title: recipes.title,
    })
    .from(recipes)
    .where(and(filtersWhere(database, filters), keysetWhere(recipes, pageParameter)))
    .orderBy(order(recipes.sortKey), order(recipes.id))
    .limit(PAGE_SIZE + 1)
    .all();
  return toPage(rowList, pageParameter);
}

// A random recipe among those matching the filters, other than `excludedId` when possible (asking
// again must change the suggestion). `random` returns a number in [0, 1).
// Reads one id at a random offset instead of loading every matching id.
export function pickRandomRecipeId(
  database: AppDatabase,
  filters: RecipeFilters,
  excludedId?: number,
  random: () => number = Math.random,
): number | undefined {
  const matchingWhere = filtersWhere(database, filters);
  const otherWhere =
    excludedId === undefined ? matchingWhere : and(matchingWhere, ne(recipes.id, excludedId));
  const otherCount =
    database.select({ count: count() }).from(recipes).where(otherWhere).get()?.count ?? 0;
  // Only the excluded recipe matches: suggest it again.
  const where = otherCount > 0 ? otherWhere : matchingWhere;
  const candidateCount = otherCount > 0 ? otherCount : countRecipes(database, filters);
  return candidateCount === 0
    ? undefined
    : database
        .select({ id: recipes.id })
        .from(recipes)
        .where(where)
        .orderBy(asc(recipes.id))
        .limit(1)
        .offset(Math.floor(random() * candidateCount))
        .get()?.id;
}

// Creates (no id) or updates a recipe and its ingredients in one transaction; returns its id.
// Only the ingredient links that changed are written.
export function saveRecipe(database: AppDatabase, input: RecipeInput, id?: number): number {
  const title = cleanName(input.title);
  if (!title) {
    throw new Error('A recipe title cannot be blank');
  }
  const values = {
    course: input.course ?? null,
    instructions: input.instructions.trim(),
    season: input.season,
    sortKey: toSortKey(title),
    title,
  };
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

// Recipes in the season (or for both seasons), of the course, and made with ALL the ingredients. With
// ingredients, the plan starts from the (ingredient_id, recipe_id) index, so only recipes
// containing a selected ingredient are visited.
function filtersWhere(database: AppDatabase, filters: RecipeFilters): SQL | undefined {
  const conditionList: SQL[] = [];
  const titleSearch = titleSearchWhere(filters.search ?? '');
  if (titleSearch) {
    conditionList.push(titleSearch);
  }
  if (filters.season) {
    conditionList.push(inArray(recipes.season, [filters.season, 'both']));
  }
  if (filters.course) {
    conditionList.push(eq(recipes.course, filters.course));
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
  return and(...conditionList);
}

// Titles containing the search, ignoring case and accents (on sort_key); no condition when blank.
function titleSearchWhere(search: string): SQL | undefined {
  return cleanName(search)
    ? sql`${recipes.sortKey} like ${toLikeContains(search)} escape '\\'`
    : undefined;
}

function updateRecipe(
  tx: Pick<AppDatabase, 'update'>,
  id: number,
  values: Readonly<{
    course: Course | null;
    instructions: string;
    season: Season;
    sortKey: string;
    title: string;
  }>,
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
