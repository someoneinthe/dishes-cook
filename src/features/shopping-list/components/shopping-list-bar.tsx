import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import { usePicks } from '../meal-picks';

// At the bottom of the meal choice, once the shopping list holds meals: opens it, with their
// count (the user's choice: the next step, under the meals being picked). Not on a TV.
export function ShoppingListBar() {
  const t = useMessages();
  const pickList = usePicks();
  // Above the phone's navigation bar or gesture area (the app draws behind them).
  const { bottom } = useSafeAreaInsets();
  // A prop-computed padding: the theme is read here.
  const { theme } = useUnistyles();
  if (isTv || pickList.length === 0) {
    return null;
  }
  return (
    <View style={[styles.bar, { paddingBottom: theme.gap(3) + bottom }]}>
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
    paddingTop: theme.gap(3),
  },
  content: {
    // Centered on wide screens, like the screen's content.
    alignSelf: 'center',
    flexDirection: 'row',
    maxWidth: theme.size.maxContent,
    width: '100%',
  },
}));
