import type { SQL } from 'drizzle-orm';
import { and, asc, count, desc, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import type { Page, PageRequest } from '@/db/pagination';
import type { Course, RecipeKind, Season } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { Quantity } from '@/lib/units';
import { isBackward, keysetWhere, PAGE_SIZE, toPage } from '@/db/pagination';
import { ingredients, NOW_MS, recipeIngredients, recipes, syncDeletions } from '@/db/schema';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import {
  LAST_COOKED_AT,
  notCookedSinceWhere,
} from '@/features/meal-history/db/cooked-meal-queries';
import { cleanName, toDisplayName, toLikeContains, toSortKey } from '@/lib/text';
import { toQuantity, toStored } from '@/lib/units';
import { toMinutes } from '../minutes';
import { toMonths } from '../months';

export type Recipe = Readonly<{
  // Cooking time in minutes; left out when not given (like prepMinutes).
  cookMinutes?: number;
  course: Course;
  id: number;
  ingredientList: RecipeIngredient[];
  instructions: string;
  kind: RecipeKind;
  // A drink's maturation time in months; left out when not given (like prepMinutes).
  maturationMonths?: number;
  // Its photo's file name in the app's documents (RECIPE_PHOTO_FOLDER); left out without a photo.
  photoFile?: string;
  prepMinutes?: number;
  season: Season;
  title: string;
}>;

export type RecipeFilters = Readonly<{
  // Recipes of this course; undefined = any course.
  course?: Course;
  // Recipes made with ALL these ingredients.
  ingredientIdList: readonly number[];
  // Dishes or drinks: every list is one or the other.
  kind: RecipeKind;
  // Titles containing it, ignoring case and accents; undefined or blank = any title.
  search?: string;
  // A season also matches the recipes for both seasons; undefined = any season.
  season?: Exclude<Season, 'both'>;
}>;

// An ingredient of a recipe, with how much of it the recipe needs (none: "salt").
export type RecipeIngredient = Ingredient & Readonly<{ quantity?: Quantity }>;

export type RecipeInput = Readonly<{
  // Minutes (positive, at most MAX_MINUTES); null or left out = none.
  cookMinutes?: null | number;
  // A main course when left out.
  course?: Course;
  // Ids below 0: ingredients to create when the recipe is saved, named in `newIngredientNames`.
  ingredientIdList: readonly number[];
  instructions: string;
  // A dish when left out on a new recipe; left out = unchanged on an edit.
  kind?: RecipeKind;
  // A drink's maturation time in months (above 0, at most MAX_MONTHS); null or left out = none.
  maturationMonths?: null | number;
  // Names of the ingredients to create (e.g. read from a photo), by their temporary id (below 0).
  newIngredientNames?: ReadonlyMap<number, string>;
  // A new photo (its file, already in RECIPE_PHOTO_FOLDER), null to remove it; left out = unchanged.
  // Either way it's synced again: the server's copy no longer matches.
  photo?: null | Readonly<{ file: string }>;
  prepMinutes?: null | number;
  // Quantities by ingredient id; an ingredient without one has no quantity.
  quantities?: ReadonlyMap<number, Quantity>;
  season: Season;
  title: string;
}>;

export type RecipeListItem = Readonly<{
  course: Course;
  id: number;
  ingredientCount: number;
  // A drink's maturation time in months; left out when not given.
  maturationMonths?: number;
  season: Season;
  sortKey: string;
  title: string;
}>;

// Number of ingredients of the recipe, read from the (recipe_id, ingredient_id) primary key.
// Written out qualified: Drizzle renders `${recipes.id}` as a bare "id" inside a select.
const INGREDIENT_COUNT = sql<number>`(select count(*) from "recipe_ingredients" where "recipe_ingredients"."recipe_id" = "recipes"."id")`;

export type PickOptions = Readonly<{
  // The current suggestion: another one is picked when possible (asking again must change it).
  excludedId?: number;
  // Never picked, by sync id (the meals already in the shopping list): at most MAX_PICKS.
  omittedSyncIdList?: readonly string[];
  // Returns a number in [0, 1).
  random?: () => number;
  // Recipes cooked at or after this time (ms) are skipped (the meal history); undefined = none.
  // When every match was cooked since then, the one cooked longest ago is picked.
  skipCookedSince?: number;
}>;

// Number of recipes matching the filters (the recipe list shows it).
export function countRecipes(database: AppDatabase, filters: RecipeFilters): number {
  return (
    database.select({ count: count() }).from(recipes).where(filtersWhere(database, filters)).get()
      ?.count ?? 0
  );
}
// Its ingredient links are deleted by the foreign key's ON DELETE CASCADE. The deletion is kept for
// the sync server.
export function deleteRecipe(database: AppDatabase, id: number): void {
  database.transaction((tx) => {
    const deleted = tx
      .delete(recipes)
      .where(eq(recipes.id, id))
      .returning({ syncId: recipes.syncId })
      .get();
    if (deleted) {
      tx.insert(syncDeletions)
        .values({ syncId: deleted.syncId, tableName: 'recipes' })
        .onConflictDoUpdate({
          set: { deletedAt: NOW_MS },
          target: [syncDeletions.tableName, syncDeletions.syncId],
        })
        .run();
    }
  });
}

export function getRecipe(database: AppDatabase, id: number): Recipe | undefined {
  const recipe = database
    .select({
      cookMinutes: recipes.cookMinutes,
      course: recipes.course,
      id: recipes.id,
      instructions: recipes.instructions,
      kind: recipes.kind,
      maturationMonths: recipes.maturationMonths,
      photoFile: recipes.photoFile,
      prepMinutes: recipes.prepMinutes,
      season: recipes.season,
      title: recipes.title,
    })
    .from(recipes)
    .where(eq(recipes.id, id))
    .get();
  if (!recipe) {
    return undefined;
  }
  const { cookMinutes, maturationMonths, photoFile, prepMinutes, ...fields } = recipe;
  const linkList = database
    .select({
      amount: recipeIngredients.amount,
      id: ingredients.id,
      name: ingredients.name,
      unit: recipeIngredients.unit,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
    .where(eq(recipeIngredients.recipeId, id))
    .orderBy(asc(ingredients.sortKey), asc(ingredients.id))
    .all();
  // Not paginated: a recipe's own ingredients, bounded by what the form lets you add.
  const ingredientList = linkList.map(({ amount, id: ingredientId, name, unit }) => {
    const quantity = toQuantity(amount, unit);
    const shownName = toDisplayName(name);
    return quantity
      ? { id: ingredientId, name: shownName, quantity }
      : { id: ingredientId, name: shownName };
  });
  return {
    ...fields,
    ingredientList,
    title: toDisplayName(recipe.title),
    // Left out when not given: a recipe without them reads as before.
    ...(toMinutes(cookMinutes) !== undefined && { cookMinutes: toMinutes(cookMinutes) }),
    ...(toMonths(maturationMonths) !== undefined && {
      maturationMonths: toMonths(maturationMonths),
    }),
    ...(photoFile !== null && { photoFile }),
    ...(toMinutes(prepMinutes) !== undefined && { prepMinutes: toMinutes(prepMinutes) }),
  };
}

// The recipe's sync id: its identity across devices, which is never reused (unlike its integer id,
// SQLite's rowid, which a new recipe can get once the last one is deleted).
export function getRecipeSyncId(database: AppDatabase, id: number): string | undefined {
  return database.select({ syncId: recipes.syncId }).from(recipes).where(eq(recipes.id, id)).get()
    ?.syncId;
}

// Whether the recipe is still saved (it may have been deleted by a sync while being edited).
export function isRecipeSaved(database: AppDatabase, id: number): boolean {
  return (
    database.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id)).get() !== undefined
  );
}

// One page (PAGE_SIZE) of the alphabetical recipe list, narrowed by the filters (title search,
// season, course, ingredients). `instructions` (possibly long) is left out.
// Plan: walk the (kind, sort_key, id) index from the cursor, count links on the primary key.
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
      maturationMonths: recipes.maturationMonths,
      season: recipes.season,
      sortKey: recipes.sortKey,
      title: recipes.title,
    })
    .from(recipes)
    .where(and(filtersWhere(database, filters), keysetWhere(recipes, pageParameter)))
    .orderBy(order(recipes.sortKey), order(recipes.id))
    .limit(PAGE_SIZE + 1)
    .all();
  return toPage(
    rowList.map(({ maturationMonths, ...row }) => ({
      ...row,
      title: toDisplayName(row.title),
      ...(toMonths(maturationMonths) !== undefined && {
        maturationMonths: toMonths(maturationMonths),
      }),
    })),
    pageParameter,
  );
}

// A random recipe among those matching the filters (see PickOptions).
// Reads one id at a random offset instead of loading every matching id, in (sort_key, id) order:
// without other filters than the kind, the walk to the offset stays in the (kind, sort_key, id)
// index instead of reading whole rows.
export function pickRandomRecipeId(
  database: AppDatabase,
  filters: RecipeFilters,
  options: PickOptions = {},
): number | undefined {
  const { excludedId, omittedSyncIdList = [], random = Math.random, skipCookedSince } = options;
  const filtersMatch = filtersWhere(database, filters);
  const matchingWhere =
    omittedSyncIdList.length === 0
      ? filtersMatch
      : and(filtersMatch, notInArray(recipes.syncId, [...omittedSyncIdList]));
  return skipCookedSince === undefined
    ? pickAtRandom(database, matchingWhere, excludedId, random)
    : (pickAtRandom(
        database,
        and(matchingWhere, notCookedSinceWhere(skipCookedSince)),
        excludedId,
        random,
      ) ?? pickLeastRecentlyCooked(database, matchingWhere, excludedId));
}

// Creates (no id) or updates a recipe and its ingredients (with their quantities) in one
// transaction, creating the new ingredients too; returns its id. Only the ingredient links that
// changed are written.
export function saveRecipe(database: AppDatabase, input: RecipeInput, id?: number): number {
  // Saved in lowercase, shown with a capital first letter (toDisplayName), like ingredients.
  const title = cleanName(input.title).toLowerCase();
  if (!title) {
    throw new Error('A recipe title cannot be blank');
  }
  const values = {
    cookMinutes: toMinutes(input.cookMinutes) ?? null,
    course: input.course ?? 'main',
    instructions: input.instructions.trim(),
    ...(input.kind !== undefined && { kind: input.kind }),
    maturationMonths: toMonths(input.maturationMonths) ?? null,
    prepMinutes: toMinutes(input.prepMinutes) ?? null,
    season: input.season,
    sortKey: toSortKey(title),
    title,
    // A new photo: uploaded by the next sync (no server copy matches it yet). None: the server's
    // copy (photo_synced) is kept, so that the next sync knows to remove it there.
    ...(input.photo !== undefined && {
      photoFile: input.photo?.file ?? null,
      photoPending: null,
      ...(input.photo !== null && { photoSynced: null }),
    }),
  };
  return database.transaction((tx) => {
    // Only the new ingredients still in the recipe; one may exist by now (same name, ignoring
    // case): it's used then.
    const realIdMap = new Map(
      [...(input.newIngredientNames ?? [])]
        .filter(([temporaryId]) => input.ingredientIdList.includes(temporaryId))
        .map(([temporaryId, name]) => [temporaryId, findOrCreateIngredient(tx, name).id]),
    );
    const toRealId = (ingredientId: number) => realIdMap.get(ingredientId) ?? ingredientId;
    const ingredientIdList = [
      ...new Set(input.ingredientIdList.map((ingredientId) => toRealId(ingredientId))),
    ];
    const quantities = new Map(
      [...(input.quantities ?? [])].map(([ingredientId, quantity]) => [
        toRealId(ingredientId),
        quantity,
      ]),
    );
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
        .values(
          ingredientIdList.map((ingredientId) => {
            const quantity = quantities.get(ingredientId);
            const typed = quantity && toQuantity(quantity.amount, quantity.unit);
            // Weights in grams, volumes in millilitres (src/lib/units.ts).
            const checked = typed && toStored(typed);
            return {
              amount: checked?.amount ?? null,
              ingredientId,
              recipeId,
              unit: checked?.unit ?? null,
            };
          }),
        )
        .onConflictDoUpdate({
          set: { amount: sql`excluded.amount`, unit: sql`excluded.unit` },
          // Links whose quantity didn't change aren't rewritten.
          setWhere: sql`${recipeIngredients.amount} is not excluded.amount or ${recipeIngredients.unit} is not excluded.unit`,
          target: [recipeIngredients.recipeId, recipeIngredients.ingredientId],
        })
        .run();
    }
    return recipeId;
  });
}

// Recipes in the season (or for both seasons), of the course, and made with ALL the ingredients. With
// ingredients, the plan starts from the (ingredient_id, recipe_id) index, so only recipes
// containing a selected ingredient are visited.
function filtersWhere(database: AppDatabase, filters: RecipeFilters): SQL | undefined {
  const ingredientIdList = [...new Set(filters.ingredientIdList)];
  // Without ingredients, the list walks the (kind, sort_key, id) index. With some, the plan starts
  // from the few recipes using them (the ingredient index): `+kind` keeps SQLite off the kind
  // index, which would walk every dish instead.
  const conditionList: SQL[] = [
    ingredientIdList.length > 0
      ? sql`+${recipes.kind} = ${filters.kind}`
      : eq(recipes.kind, filters.kind),
  ];
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

// A random recipe matching `where`, other than `excludedId` when another one matches.
function pickAtRandom(
  database: AppDatabase,
  where: SQL | undefined,
  excludedId: number | undefined,
  random: () => number,
): number | undefined {
  const otherWhere = excludedId === undefined ? where : and(where, ne(recipes.id, excludedId));
  const countWhere = (condition: SQL | undefined) =>
    database.select({ count: count() }).from(recipes).where(condition).get()?.count ?? 0;
  const otherCount = countWhere(otherWhere);
  // Only the excluded recipe matches: suggest it again.
  const candidateWhere = otherCount > 0 ? otherWhere : where;
  const candidateCount = otherCount > 0 ? otherCount : countWhere(where);
  return candidateCount === 0
    ? undefined
    : database
        .select({ id: recipes.id })
        .from(recipes)
        .where(candidateWhere)
        .orderBy(asc(recipes.sortKey), asc(recipes.id))
        .limit(1)
        .offset(Math.floor(random() * candidateCount))
        .get()?.id;
}

// The matching recipe cooked longest ago, other than `excludedId` when another one matches. Only
// used when every match was cooked recently: they're few (the meals of a few weeks), each sorted
// by a lookup of its last meal in the (recipe_id, cooked_at) index.
function pickLeastRecentlyCooked(
  database: AppDatabase,
  where: SQL | undefined,
  excludedId: number | undefined,
): number | undefined {
  const pick = (condition: SQL | undefined) =>
    database
      .select({ id: recipes.id })
      .from(recipes)
      .where(condition)
      .orderBy(asc(LAST_COOKED_AT), asc(recipes.sortKey), asc(recipes.id))
      .limit(1)
      .get()?.id;
  return (
    (excludedId === undefined ? undefined : pick(and(where, ne(recipes.id, excludedId)))) ??
    pick(where)
  );
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
    cookMinutes: null | number;
    course: Course;
    instructions: string;
    maturationMonths: null | number;
    photoFile?: null | string;
    photoPending?: null;
    photoSynced?: null;
    prepMinutes: null | number;
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
