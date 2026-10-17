import { Button } from '@/components/button';
import { useRecipeSyncId } from '@/features/recipes/hooks/use-recipes';
import { useMessages } from '@/i18n/i18n-provider';
import { addPick, MAX_PICKS, removePick, usePicks } from '../meal-picks';

type ShoppingListToggleProps = Readonly<{ recipeId: number }>;

// Adds the recipe to the shopping list or takes it out (a header button of the recipe screen),
// tinted while it's in. Disabled while the list is full.
export function ShoppingListToggle({ recipeId }: ShoppingListToggleProps) {
  const t = useMessages();
  const pickList = usePicks();
  const syncId = useRecipeSyncId(recipeId);
  if (syncId === undefined) {
    return null;
  }
  const isPicked = pickList.includes(syncId);
  const isFull = !isPicked && pickList.length >= MAX_PICKS;
  let hint = t.shoppingList.addToListHint;
  if (isPicked) {
    hint = t.shoppingList.removeHint;
  } else if (isFull) {
    hint = t.shoppingList.fullHint(MAX_PICKS);
  }
  return (
    <Button
      accessibilityHint={hint}
      icon={isPicked ? 'cart-remove' : 'cart-plus'}
      isDisabled={isFull}
      isIconOnly
      label={isPicked ? t.shoppingList.removeFromList : t.shoppingList.addToList}
      onPress={() => (isPicked ? removePick(syncId) : addPick(syncId))}
      variant={isPicked ? 'active' : 'secondary'}
    />
  );
}
