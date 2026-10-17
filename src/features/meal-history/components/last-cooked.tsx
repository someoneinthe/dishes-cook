import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { useConfirmDelete } from '@/components/use-confirm-delete';
import { useDatabase } from '@/db/database-context';
import { useMessages } from '@/i18n/i18n-provider';
import { calendarDaysAgo } from '@/lib/dates';
import { isTv } from '@/lib/device';
import { markCooked, removeCookedMeal } from '../db/cooked-meal-queries';
import { useLastCookedMeal } from '../hooks/use-last-cooked-meal';

type LastCookedProps = Readonly<{
  // On the recipe screen: the last time can be removed (a mark made by mistake).
  isRemovable?: boolean;
  recipeId: number;
}>;

// When the recipe was last cooked, and "I cooked it" (hidden once cooked today). Read-only on a
// TV: recipes are cooked, and marked, with the phone.
export function LastCooked({ isRemovable = false, recipeId }: LastCookedProps) {
  const t = useMessages();
  const database = useDatabase();
  const confirmDelete = useConfirmDelete();
  const lastCooked = useLastCookedMeal(recipeId);
  const daysAgo = lastCooked ? calendarDaysAgo(lastCooked.cookedAt) : undefined;
  const text = lastCooked
    ? t.mealHistory.lastCooked(daysAgo ?? 0, lastCooked.cookedAt)
    : t.mealHistory.neverCooked;

  const askToRemove = () => {
    if (!lastCooked) {
      return;
    }
    confirmDelete({
      message: t.mealHistory.removeMessage,
      name: text,
      onConfirm: () => removeCookedMeal(database, lastCooked.id),
    });
  };

  return (
    <View style={styles.row}>
      <Text style={styles.text}>{text}</Text>
      {!isTv && lastCooked && isRemovable && (
        // With its text: the header's trash can deletes the recipe itself.
        <Button
          accessibilityHint={t.common.deleteHint}
          accessibilityLabel={t.mealHistory.removeLabel}
          icon="trash-can-outline"
          label={t.mealHistory.remove}
          onPress={askToRemove}
          variant="danger"
        />
      )}
      {!isTv && daysAgo !== 0 && (
        <Button
          accessibilityHint={t.mealHistory.cookedHint}
          icon="pot-steam-outline"
          label={t.mealHistory.cooked}
          onPress={() => markCooked(database, recipeId)}
          variant="secondary"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    alignItems: 'center',
    columnGap: theme.gap(3),
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: theme.gap(2),
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
}));
