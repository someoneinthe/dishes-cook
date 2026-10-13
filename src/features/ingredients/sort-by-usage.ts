import type { IngredientListItem } from './db/ingredient-queries';

// Most used first, so the likeliest picks are suggested before typing. The sort is stable: equally
// used ingredients keep their alphabetical order.
export function sortByUsage(ingredientList: readonly IngredientListItem[]): IngredientListItem[] {
  // Copy then sort: Hermes has no Array.prototype.toSorted.
  return [...ingredientList].sort((left, right) => right.recipeCount - left.recipeCount);
}
