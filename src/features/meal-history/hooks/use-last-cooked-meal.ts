import { useDatabase } from '@/db/database-context';
import { useLocalQuery } from '@/db/use-local-query';
import { getLastCookedMeal } from '../db/cooked-meal-queries';

// The last time the recipe was cooked; undefined if it never was.
export function useLastCookedMeal(recipeId: number) {
  const database = useDatabase();
  // TanStack Query doesn't store `undefined`: never cooked is `null`.
  const read = () => getLastCookedMeal(database, recipeId) ?? null;
  const data = useLocalQuery(['cookedMeals', 'last', recipeId], read);
  return data ?? undefined;
}
