import type { DependencyList } from 'react';
import { useEffect, useState } from 'react';
import type { AppDatabase } from './types';
import { useDatabaseConnection } from './database-context';

// Runs a synchronous query and re-runs it after every write to the database (see
// change-notifier.ts). Data is there on the first render: no loading state, no empty flash.
//
// `dependencies` are the query's inputs, like useMemo's.
export function useLiveQuery<T>(
  query: (database: AppDatabase) => T,
  dependencies: DependencyList,
): T {
  // Opted out of the React Compiler: it assumes functions are pure and memoizes `query(db)` by its
  // arguments, which don't change after a write, so the second write onwards returned stale data.
  // Components using this hook are still compiled; tests run with the compiler (jest.config.js).
  'use no memo';
  const { db, subscribe } = useDatabaseConnection();
  const [version, setVersion] = useState(0);

  useEffect(() => subscribe(() => setVersion((current) => current + 1)), [subscribe]);

  // Re-runs the query when its inputs change or after a write (`version`), during render so the
  // new data shows in the same render (React's "adjust state when a prop changes" pattern).
  const inputList = [db, version, ...dependencies];
  const [result, setResult] = useState(() => ({ inputList, value: query(db) }));
  if (!haveSameItems(result.inputList, inputList)) {
    const next = { inputList, value: query(db) };
    setResult(next);
    return next.value;
  }
  return result.value;
}

function haveSameItems(leftList: readonly unknown[], rightList: readonly unknown[]): boolean {
  return (
    leftList.length === rightList.length &&
    leftList.every((item, index) => Object.is(item, rightList[index]))
  );
}
