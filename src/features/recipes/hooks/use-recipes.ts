import { useQuery } from '@tanstack/react-query';
import { useDatabase } from '@/db/database-context';
import { usePagedQuery } from '@/db/use-paged-query';
import type { RecipeFilters } from '../db/recipe-queries';
import { countRecipes, getRecipe, getRecipeSyncId, listRecipePage } from '../db/recipe-queries';

// `id` undefined: no recipe (nothing is read).
export function useRecipe(id: number | undefined) {
  const database = useDatabase();
  // TanStack Query doesn't store `undefined`: a missing recipe is `null`.
  const read = () => (id === undefined ? null : (getRecipe(database, id) ?? null));
  const { data } = useQuery({
    initialData: read,
    queryFn: read,
    queryKey: ['recipes', 'detail', id],
  });
  return data ?? undefined;
}

export function useRecipeCount(filters: RecipeFilters) {
  const database = useDatabase();
  const { course, ingredientIdList, search, season } = filters;
  const count = () => countRecipes(database, { course, ingredientIdList, search, season });
  const { data } = useQuery({
    initialData: count,
    queryFn: count,
    queryKey: ['recipes', 'count', { course, ingredientIdList, search, season }],
  });
  return data;
}

// The alphabetical recipe list, page by page, narrowed by the filters.
export function useRecipePages(filters: RecipeFilters) {
  const database = useDatabase();
  const { course, ingredientIdList, search, season } = filters;
  return usePagedQuery(
    ['recipes', 'pages', { course, ingredientIdList, search, season }],
    (pageParameter) =>
      listRecipePage(database, {
        filters: { course, ingredientIdList, search, season },
        pageParam: pageParameter,
      }),
  );
}

// `id` undefined: no recipe (nothing is read). Undefined for a recipe that doesn't exist.
export function useRecipeSyncId(id: number | undefined) {
  const database = useDatabase();
  const read = () => (id === undefined ? null : (getRecipeSyncId(database, id) ?? null));
  const { data: syncId } = useQuery({
    initialData: read,
    queryFn: read,
    queryKey: ['recipes', 'syncId', id],
  });
  return syncId ?? undefined;
}
