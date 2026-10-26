import { useDatabase } from '@/db/database-context';
import { useLocalQuery } from '@/db/use-local-query';
import { usePagedQuery } from '@/db/use-paged-query';
import type { RecipeFilters } from '../db/recipe-queries';
import {
  countRecipes,
  getRecipe,
  getRecipeCard,
  getRecipeSyncId,
  listRecipePage,
} from '../db/recipe-queries';

// `id` undefined: no recipe (nothing is read).
export function useRecipe(id: number | undefined) {
  const database = useDatabase();
  // TanStack Query doesn't store `undefined`: a missing recipe is `null`.
  const read = () => (id === undefined ? null : (getRecipe(database, id) ?? null));
  const data = useLocalQuery(['recipes', 'detail', id], read);
  return data ?? undefined;
}

// A recipe in short (the meal choice's card); undefined once it's deleted.
export function useRecipeCard(id: number | undefined) {
  const database = useDatabase();
  const read = () => (id === undefined ? null : (getRecipeCard(database, id) ?? null));
  return useLocalQuery(['recipes', 'card', id], read) ?? undefined;
}

export function useRecipeCount(filters: RecipeFilters) {
  const database = useDatabase();
  const { course, ingredientIdList, kind, mine, search, season } = filters;
  const count = () =>
    countRecipes(database, { course, ingredientIdList, kind, mine, search, season });
  return useLocalQuery(
    ['recipes', 'count', { course, ingredientIdList, kind, mine, search, season }],
    count,
  );
}

// The alphabetical recipe list, page by page, narrowed by the filters.
export function useRecipePages(filters: RecipeFilters) {
  const database = useDatabase();
  const { course, ingredientIdList, kind, mine, search, season } = filters;
  return usePagedQuery(
    ['recipes', 'pages', { course, ingredientIdList, kind, mine, search, season }],
    (pageParameter) =>
      listRecipePage(database, {
        filters: { course, ingredientIdList, kind, mine, search, season },
        pageParam: pageParameter,
      }),
  );
}

// `id` undefined: no recipe (nothing is read). Undefined for a recipe that doesn't exist.
export function useRecipeSyncId(id: number | undefined) {
  const database = useDatabase();
  const read = () => (id === undefined ? null : (getRecipeSyncId(database, id) ?? null));
  const syncId = useLocalQuery(['recipes', 'syncId', id], read);
  return syncId ?? undefined;
}
