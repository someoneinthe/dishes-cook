import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { DependencyList } from 'react';
import { getTableName } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import type { AppDatabase } from './types';
import { useDatabaseConnection } from './database-context';

// Runs a synchronous query and re-runs it when one of `tableList` is written to.
//
// Unlike Drizzle's useLiveQuery, it listens to every table the query reads (joins and subqueries
// included, not only the FROM table), returns data on the first render (no empty flash), and
// re-runs once per write instead of once per modified row.
//
// `dependencies` are the query's inputs, like useMemo's.
export function useLiveQuery<T>(
  query: (database: AppDatabase) => T,
  dependencies: DependencyList,
  tableList: readonly SQLiteTable[],
): T {
  const { db, subscribe } = useDatabaseConnection();
  const [version, setVersion] = useState(0);
  const tablesKey = tableList.map((table) => getTableName(table)).join(',');

  useEffect(() => {
    const watchedTables = new Set(tablesKey.split(','));
    return subscribe((tableName) => {
      if (watchedTables.has(tableName)) {
        setVersion((current) => current + 1);
      }
    });
  }, [subscribe, tablesKey]);

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
