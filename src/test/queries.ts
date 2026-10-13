import type { AppDatabase } from '@/db/types';
import { listIngredientPage } from '@/features/ingredients/db/ingredient-queries';
import { listRecipePage } from '@/features/recipes/db/recipe-queries';

// First page (up to PAGE_SIZE rows) of the lists, for assertions on small test data.
export function firstIngredientPage(database: AppDatabase) {
  return listIngredientPage(database, { pageParam: null, search: '' }).itemList;
}

export function firstRecipePage(database: AppDatabase) {
  return listRecipePage(database, null).itemList;
}
