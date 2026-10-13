import { useLiveQuery } from '@/db/use-live-query';
import { listIngredients } from '../db/ingredient-queries';

// Every ingredient with its usage count, kept up to date.
export function useIngredientList() {
  return useLiveQuery(listIngredients, []);
}
