import { useLiveQuery } from '@/db/use-live-query';
import { getRecipe, hasAnyRecipe, listRecipes, RECIPE_TABLES } from '../db/recipe-queries';

export function useHasAnyRecipe() {
  return useLiveQuery(hasAnyRecipe, [], RECIPE_TABLES);
}

// `id` undefined: no recipe (nothing is read).
export function useRecipe(id: number | undefined) {
  return useLiveQuery(
    (database) => (id === undefined ? undefined : getRecipe(database, id)),
    [id],
    RECIPE_TABLES,
  );
}

export function useRecipeList() {
  return useLiveQuery(listRecipes, [], RECIPE_TABLES);
}
