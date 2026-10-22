import { router } from 'expo-router';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import { usePicks } from '../meal-picks';

// At the bottom of the meal choice, once the shopping list holds meals: opens it, with their
// count (the user's choice: the next step, under the meals being picked). Not on a TV.
export function ShoppingListBar() {
  const t = useMessages();
  const pickList = usePicks();
  if (isTv || pickList.length === 0) {
    return null;
  }
  return (
    <View style={styles.bar}>
      <View style={styles.content}>
        <Button
          accessibilityHint={t.shoppingList.openHint}
          accessibilityLabel={t.shoppingList.openLabel(pickList.length)}
          icon="cart-outline"
          isFilling
          label={t.shoppingList.openButton(pickList.length)}
          onPress={() => router.navigate('/shopping-list')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderTopWidth: theme.borderWidth,
    paddingHorizontal: theme.gap(4),
    paddingVertical: theme.gap(3),
  },
  content: {
    // Centered on wide screens, like the screen's content.
    alignSelf: 'center',
    flexDirection: 'row',
    maxWidth: theme.size.maxContent,
    width: '100%',
  },
}));
