import { useLiveQuery } from '@/db/use-live-query';
import { getRecipe, hasAnyRecipe, listRecipes } from '../db/recipe-queries';

export function useHasAnyRecipe() {
  return useLiveQuery(hasAnyRecipe, []);
}

// `id` undefined: no recipe (nothing is read).
export function useRecipe(id: number | undefined) {
  return useLiveQuery((database) => (id === undefined ? undefined : getRecipe(database, id)), [id]);
}

export function useRecipeList() {
  return useLiveQuery(listRecipes, []);
}
