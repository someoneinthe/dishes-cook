import { createContext, use } from 'react';
import type { DatabaseConnection } from './types';

export const DatabaseContext = createContext<DatabaseConnection | null>(null);

export function useDatabase() {
  return useDatabaseConnection().db;
}

export function useDatabaseConnection(): DatabaseConnection {
  const connection = use(DatabaseContext);
  if (!connection) {
    throw new Error('useDatabaseConnection must be used inside a database provider');
  }
  return connection;
}
