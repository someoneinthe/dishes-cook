import { useQuery } from '@tanstack/react-query';
import { useDatabase } from '@/db/database-context';
import { listPickedMeals, listShoppingLines } from '../db/shopping-queries';

// The picked meals that still exist, by title.
export function usePickedMeals(pickList: readonly string[]) {
  const database = useDatabase();
  const read = () => listPickedMeals(database, pickList);
  const { data: mealList } = useQuery({
    initialData: read,
    queryFn: read,
    queryKey: ['shoppingList', 'meals', pickList],
  });
  return mealList;
}

// The ingredients of the picked meals, one line per ingredient and unit, amounts added up, and
// whether some were left out (more than MAX_LINES).
export function useShoppingLines(pickList: readonly string[]) {
  const database = useDatabase();
  const read = () => listShoppingLines(database, pickList);
  const { data: shoppingLines } = useQuery({
    initialData: read,
    queryFn: read,
    queryKey: ['shoppingList', 'lines', pickList],
  });
  return shoppingLines;
}
