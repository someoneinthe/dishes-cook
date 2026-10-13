import type { QueryKey } from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Page, PageRequest } from './pagination';
import { MAX_PAGES } from './pagination';

// A list loaded PAGE_SIZE rows at a time (infinite scroll), keeping at most MAX_PAGES in memory.
// `fetchPage` is a synchronous query: the first page is there on the first render (no loading
// flash), later pages load when the list reaches an end.
export function usePagedQuery<T>(
  queryKey: QueryKey,
  fetchPage: (pageRequest: PageRequest) => Page<T>,
) {
  // Property order required by @tanstack/query (queryFn before the page param getters, for type
  // inference), not alphabetical.
  /* eslint-disable perfectionist/sort-objects */
  const query = useInfiniteQuery({
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (lastPage: Page<T>): PageRequest | undefined =>
      lastPage.nextCursor && { after: lastPage.nextCursor },
    initialData: () => ({ pageParams: [null], pages: [fetchPage(null)] }),
    initialPageParam: null as PageRequest,
    maxPages: MAX_PAGES,
    getPreviousPageParam: (firstPage: Page<T>): PageRequest | undefined =>
      firstPage.previousCursor && { before: firstPage.previousCursor },
    queryKey,
  });
  /* eslint-enable perfectionist/sort-objects */

  return {
    fetchNextPage: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
    fetchPreviousPage: () => {
      if (query.hasPreviousPage && !query.isFetchingPreviousPage) {
        void query.fetchPreviousPage();
      }
    },
    isFetchingNextPage: query.isFetchingNextPage,
    itemList: query.data.pages.flatMap((page) => page.itemList),
  };
}
