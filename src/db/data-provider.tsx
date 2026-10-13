import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { DatabaseConnection } from './types';
import { DatabaseContext } from './database-context';

type DataProviderProps = Readonly<{
  children: ReactNode;
  connection: DatabaseConnection;
  queryClient: QueryClient;
}>;

// Data is local and only changes through our own writes, which invalidate the queries: cached
// results never go stale on their own, there's no network to retry, and nothing to wait for.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { networkMode: 'always', retry: false, staleTime: Infinity },
    },
  });
}

// Gives screens the database and TanStack Query, and refreshes every query after each write batch
// (a write may change any list: counts, cascaded deletes…; local queries are cheap to re-run).
export function DataProvider({ children, connection, queryClient }: DataProviderProps) {
  useEffect(
    () =>
      connection.subscribe(() => {
        void queryClient.invalidateQueries();
      }),
    [connection, queryClient],
  );

  return (
    <DatabaseContext value={connection}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DatabaseContext>
  );
}
