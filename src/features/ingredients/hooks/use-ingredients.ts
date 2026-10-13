import { useQuery } from '@tanstack/react-query';
import { useDatabase } from '@/db/database-context';
import { usePagedQuery } from '@/db/use-paged-query';
import { listIngredientPage, suggestIngredients } from '../db/ingredient-queries';

type SuggestionOptions = Parameters<typeof suggestIngredients>[1];

// The alphabetical ingredient list (with usage counts), page by page, filtered by `search`.
export function useIngredientPages(search: string) {
  const database = useDatabase();
  return usePagedQuery(['ingredients', 'pages', search], (pageParameter) =>
    listIngredientPage(database, { pageParam: pageParameter, search }),
  );
}

// A few ingredients matching `search`, for the ingredient pickers.
export function useIngredientSuggestions(options: SuggestionOptions) {
  const database = useDatabase();
  const { excludeIdList, isUsedOnly, limit, search } = options;
  const suggest = () => suggestIngredients(database, { excludeIdList, isUsedOnly, limit, search });
  const { data: suggestionList } = useQuery({
    initialData: suggest,
    queryFn: suggest,
    queryKey: ['ingredients', 'suggestions', { excludeIdList, isUsedOnly, limit, search }],
  });
  return suggestionList;
}
