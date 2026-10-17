import type { Messages } from '@/i18n/en';
import type { Quantity, UnitSystem } from '@/lib/units';
import { formatQuantity } from '@/features/recipes/quantity';
import type { PickedMeal, ShoppingLine } from './db/shopping-queries';
import { MAX_LINES } from './db/shopping-queries';

// An ingredient of the shopping list with its quantities, one per unit ("leek: 3 + 300 g"); none
// when no meal gives one ("salt").
export type ShoppingItem = Readonly<{
  ingredientId: number;
  name: string;
  quantityList: readonly Quantity[];
}>;

// "• Leek: 3 + 300 g", in the reader's units and language.
export function formatShoppingItem(t: Messages, item: ShoppingItem, units: UnitSystem): string {
  const quantityList = item.quantityList.map((quantity) => formatQuantity(t, quantity, units));
  return quantityList.length === 0
    ? item.name
    : t.quantities.line(item.name, quantityList.join(t.shoppingList.quantitySeparator));
}

// The ingredients of the list, each once: the lines come sorted by ingredient (SQL), one per unit,
// and the lines of one ingredient are put together, in the order they come.
export function toShoppingItems(lineList: readonly ShoppingLine[]): ShoppingItem[] {
  const itemList: { ingredientId: number; name: string; quantityList: Quantity[] }[] = [];
  for (const { amount, ingredientId, name, unit } of lineList) {
    let item = itemList.at(-1);
    if (item?.ingredientId !== ingredientId) {
      item = { ingredientId, name, quantityList: [] };
      itemList.push(item);
    }
    if (amount !== undefined) {
      item.quantityList.push(unit === undefined ? { amount } : { amount, unit });
    }
  }
  return itemList;
}

// The text shared with another app (a notes app, a message…): the meals, then the ingredients.
export function toShoppingText(
  t: Messages,
  options: Readonly<{
    // Lines were left out (more than MAX_LINES): said at the end.
    isTruncated?: boolean;
    itemList: readonly ShoppingItem[];
    mealList: readonly PickedMeal[];
    units: UnitSystem;
  }>,
): string {
  const { isTruncated = false, itemList, mealList, units } = options;
  return [
    t.shoppingList.title,
    '',
    t.shoppingList.mealsLine(mealList.map(({ title }) => title)),
    '',
    ...itemList.map((item) => `• ${formatShoppingItem(t, item, units)}`),
    ...(isTruncated ? ['', t.shoppingList.truncated(MAX_LINES)] : []),
  ].join('\n');
}
