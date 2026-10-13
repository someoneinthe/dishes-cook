import { useQuery } from '@tanstack/react-query';
import { useDatabase } from '@/db/database-context';
import { usePagedQuery } from '@/db/use-paged-query';
import type { RecipeFilters } from '../db/recipe-queries';
import { countRecipes, getRecipe, listRecipePage } from '../db/recipe-queries';

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
  const { course, ingredientIdList, season } = filters;
  const count = () => countRecipes(database, { course, ingredientIdList, season });
  const { data } = useQuery({
    initialData: count,
    queryFn: count,
    queryKey: ['recipes', 'count', { course, ingredientIdList, season }],
  });
  return data;
}

// The alphabetical recipe list, page by page.
export function useRecipePages() {
  const database = useDatabase();
  return usePagedQuery(['recipes', 'pages'], (pageParameter) =>
    listRecipePage(database, pageParameter),
  );
}
