import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import { usePicks } from '../meal-picks';

// How to make a shopping list from the meal choice: pick one or more meals, then share the list
// (the cart at the top right). Says how many meals it holds once there are some. Not on a TV.
export function ShoppingListHelp() {
  const t = useMessages();
  const pickList = usePicks();
  if (isTv) {
    return null;
  }
  return (
    <Text style={styles.help}>
      {pickList.length === 0
        ? t.shoppingList.helpStart
        : t.shoppingList.helpContinue(pickList.length)}
    </Text>
  );
}

const styles = StyleSheet.create((theme) => ({
  help: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
}));
