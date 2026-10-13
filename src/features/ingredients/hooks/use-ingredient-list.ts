import { useLiveQuery } from '@/db/use-live-query';
import { INGREDIENT_LIST_TABLES, listIngredients } from '../db/ingredient-queries';

// Every ingredient with its usage count, kept up to date.
export function useIngredientList() {
  return useLiveQuery(listIngredients, [], INGREDIENT_LIST_TABLES);
}
