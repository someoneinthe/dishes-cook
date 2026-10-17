import { useQuery } from '@tanstack/react-query';
import { useDatabase } from '@/db/database-context';
import { getLastCookedMeal } from '../db/cooked-meal-queries';

// The last time the recipe was cooked; undefined if it never was.
export function useLastCookedMeal(recipeId: number) {
  const database = useDatabase();
  // TanStack Query doesn't store `undefined`: never cooked is `null`.
  const read = () => getLastCookedMeal(database, recipeId) ?? null;
  const { data } = useQuery({
    initialData: read,
    queryFn: read,
    queryKey: ['cookedMeals', 'last', recipeId],
  });
  return data ?? undefined;
}
