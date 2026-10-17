import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { screenScrollProps } from '@/components/screen-scroll-props';
import { useDatabase } from '@/db/database-context';
import { markAllCooked } from '@/features/meal-history/db/cooked-meal-queries';
import { usePreferences } from '@/features/settings/preferences';
import { SyncStatusButton } from '@/features/sync/components/sync-status-button';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import { usePickedMeals, useShoppingLines } from './hooks/use-shopping-list';
import { clearPicks, removePick, usePicks } from './meal-picks';
import { formatShoppingItem, toShoppingItems, toShoppingText } from './shopping-text';

// Not on a TV: it's read-only and can't share a list. A link to it leads to the meal choice.
export function ShoppingListScreen() {
  // Sonar (S100) only sees a component when it returns a JSX element, not a ternary.
  // eslint-disable-next-line unicorn/prefer-ternary
  if (isTv) {
    return <Redirect href="/" />;
  }
  return <ShoppingList />;
}

// The meals picked (on the meal choice or a recipe) and their ingredients, added up, ready to share.
// Once shared, it offers to mark the meals as cooked (the meal history), which empties the list.
function ShoppingList() {
  const t = useMessages();
  const database = useDatabase();
  // Quantities in the reader's units (Settings › Units).
  const { units } = usePreferences();
  const pickList = usePicks();
  const mealList = usePickedMeals(pickList);
  const itemList = toShoppingItems(useShoppingLines(pickList));
  const [isAskingCooked, setIsAskingCooked] = useState(false);

  const share = async () => {
    try {
      await Share.share({ message: toShoppingText(t, { itemList, mealList, units }) });
    } catch {
      // Closed without sharing.
      return;
    }
    setIsAskingCooked(true);
  };
  const markCooked = () => {
    markAllCooked(
      database,
      mealList.map(({ id }) => id),
    );
    clearPicks();
    setIsAskingCooked(false);
  };

  const header = (
    <Drawer.Screen
      options={{
        headerRight: headerActions(
          <>
            <SyncStatusButton />
            <Button
              accessibilityHint={t.shoppingList.shareHint}
              icon="share-variant"
              isDisabled={mealList.length === 0}
              label={t.shoppingList.share}
              onPress={() => void share()}
            />
          </>,
        ),
      }}
    />
  );

  if (mealList.length === 0) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState message={t.shoppingList.emptyMessage} title={t.shoppingList.emptyTitle} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen} {...screenScrollProps}>
      {header}
      {isAskingCooked && (
        <View accessibilityLiveRegion="polite" style={styles.card}>
          <Text style={styles.text}>{t.shoppingList.markCookedMessage(mealList.length)}</Text>
          <View style={styles.actions}>
            <Button
              label={t.shoppingList.notNow}
              onPress={() => setIsAskingCooked(false)}
              variant="secondary"
            />
            <Button
              accessibilityHint={t.shoppingList.markCookedHint}
              icon="pot-steam-outline"
              label={t.shoppingList.markCooked}
              onPress={markCooked}
            />
          </View>
        </View>
      )}

      <Text accessibilityRole="header" style={styles.heading}>
        {t.shoppingList.meals(mealList.length)}
      </Text>
      <View accessibilityRole="list" style={styles.list}>
        {mealList.map(({ id, title }) => (
          <View key={id} style={styles.mealRow}>
            <Text style={styles.mealTitle}>{title}</Text>
            <Button
              accessibilityHint={t.shoppingList.removeHint}
              accessibilityLabel={t.shoppingList.removeLabel(title)}
              icon="close"
              isIconOnly
              label={t.shoppingList.removeFromList}
              onPress={() => removePick(id)}
              variant="secondary"
            />
          </View>
        ))}
      </View>

      <Text accessibilityRole="header" style={styles.heading}>
        {t.shoppingList.ingredients}
      </Text>
      {itemList.length > 0 ? (
        <View accessibilityRole="list" style={styles.list}>
          {itemList.map((item) => (
            <Text key={item.ingredientId} style={styles.text}>
              {`• ${formatShoppingItem(t, item, units)}`}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>{t.shoppingList.noIngredients}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth,
    gap: theme.gap(3),
    padding: theme.gap(4),
  },
  content: {
    // Centered on wide screens.
    alignSelf: 'center',
    gap: theme.gap(3),
    maxWidth: theme.size.maxContent,
    padding: theme.gap(4),
    width: '100%',
  },
  heading: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
    marginTop: theme.gap(2),
  },
  list: {
    gap: theme.gap(2),
  },
  mealRow: {
    alignItems: 'center',
    columnGap: theme.gap(3),
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  mealTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    flexShrink: 1,
  },
  muted: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
}));
