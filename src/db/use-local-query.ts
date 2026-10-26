import type { QueryKey } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

// A value read from the phone's database: `read` is a synchronous query, so the value is there on
// the first render (no loading state), and read again when a write invalidates the queries.
// TanStack Query doesn't store `undefined`: `read` returns `null` for "none".
export function useLocalQuery<T extends NonNullable<unknown> | null>(
  queryKey: QueryKey,
  read: () => T,
): T {
  const { data } = useQuery({ initialData: read, queryFn: read, queryKey });
  return data;
}
