import { router } from 'expo-router';
import { Button } from '@/components/button';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import { usePicks } from '../meal-picks';

// Opens the shopping list (a header button), tinted while it holds meals; read with their count.
// Not on a TV: the shopping list isn't there.
export function ShoppingListButton() {
  const t = useMessages();
  const pickList = usePicks();
  if (isTv) {
    return null;
  }
  return (
    <Button
      accessibilityHint={t.shoppingList.openHint}
      accessibilityLabel={t.shoppingList.openLabel(pickList.length)}
      icon="cart-outline"
      isIconOnly
      label={t.shoppingList.title}
      onPress={() => router.navigate('/shopping-list')}
      variant={pickList.length > 0 ? 'active' : 'secondary'}
    />
  );
}
