import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { InfoTip } from '@/components/info-tip';
import { useConfirmDelete } from '@/components/use-confirm-delete';
import { useDatabase } from '@/db/database-context';
import { usePreferences } from '@/features/settings/preferences';
import { useMessages } from '@/i18n/i18n-provider';
import { calendarDaysAgo } from '@/lib/dates';
import { isTv } from '@/lib/device';
import { markCooked, removeCookedMeal } from '../db/cooked-meal-queries';
import { useLastCookedMeal } from '../hooks/use-last-cooked-meal';

type LastCookedProps = Readonly<{
  // On the recipe screen: "I cooked it" (hidden once cooked today), and the last time can be
  // removed (a mark made by mistake). Elsewhere (the meal choice's card), only the line.
  isEditable?: boolean;
  recipeId: number;
}>;

// When the recipe was last cooked. Read-only on a TV: recipes are cooked, and marked, with the
// phone.
export function LastCooked({ isEditable = false, recipeId }: LastCookedProps) {
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
      <LastCookedStatus isEditable={isEditable} text={text} />
      {/* On the right. */}
      <View style={styles.buttons}>
        {!isTv && isEditable && lastCooked && (
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
        {!isTv && isEditable && daysAgo !== 0 && (
          <Button
            accessibilityHint={t.mealHistory.cookedHint}
            icon="pot-steam-outline"
            label={t.mealHistory.cooked}
            onPress={() => markCooked(database, recipeId)}
            variant="secondary"
          />
        )}
      </View>
    </View>
  );
}

// When it was last cooked. On the recipe screen's bottom bar, centered in the room the buttons
// leave, with an ⓘ telling what marking it does (Settings › Skip recent meals).
function LastCookedStatus({ isEditable, text }: Readonly<{ isEditable: boolean; text: string }>) {
  const t = useMessages();
  const { recentMealDays } = usePreferences();
  return (
    <View style={[styles.status, isEditable && styles.centeredStatus]}>
      {/* Smaller on the meal choice's card: a detail of the suggestion. */}
      <Text style={[styles.text, !isEditable && styles.smallText]}>{text}</Text>
      {isEditable && (
        <InfoTip
          label={t.mealHistory.aboutLabel}
          message={t.mealHistory.about(recentMealDays, isTv)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  buttons: {
    columnGap: theme.gap(3),
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  centeredStatus: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  row: {
    alignItems: 'center',
    columnGap: theme.gap(3),
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: theme.gap(2),
  },
  smallText: theme.typography.caption,
  status: {
    alignItems: 'center',
    columnGap: theme.gap(2),
    flexDirection: 'row',
    flexShrink: 1,
  },
  text: {
    flexShrink: 1,
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
}));
