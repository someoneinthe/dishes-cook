import { useDatabase } from '@/db/database-context';
import { useLocalQuery } from '@/db/use-local-query';
import { listPickedMeals, listShoppingLines } from '../db/shopping-queries';

// The picked meals that still exist, by title.
export function usePickedMeals(pickList: readonly string[]) {
  const database = useDatabase();
  const read = () => listPickedMeals(database, pickList);
  return useLocalQuery(['shoppingList', 'meals', pickList], read);
}

// The ingredients of the picked meals, one line per ingredient and unit, amounts added up, and
// whether some were left out (more than MAX_LINES).
export function useShoppingLines(pickList: readonly string[]) {
  const database = useDatabase();
  const read = () => listShoppingLines(database, pickList);
  return useLocalQuery(['shoppingList', 'lines', pickList], read);
}
