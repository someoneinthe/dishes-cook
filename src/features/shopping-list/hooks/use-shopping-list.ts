import { useQuery } from '@tanstack/react-query';
import { useDatabase } from '@/db/database-context';
import { listPickedMeals, listShoppingLines } from '../db/shopping-queries';

// The picked meals that still exist, by title.
export function usePickedMeals(pickList: readonly number[]) {
  const database = useDatabase();
  const read = () => listPickedMeals(database, pickList);
  const { data: mealList } = useQuery({
    initialData: read,
    queryFn: read,
    queryKey: ['shoppingList', 'meals', pickList],
  });
  return mealList;
}

// The ingredients of the picked meals, one line per ingredient and unit, amounts added up.
export function useShoppingLines(pickList: readonly number[]) {
  const database = useDatabase();
  const read = () => listShoppingLines(database, pickList);
  const { data: lineList } = useQuery({
    initialData: read,
    queryFn: read,
    queryKey: ['shoppingList', 'lines', pickList],
  });
  return lineList;
}
