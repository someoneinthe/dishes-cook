import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { RecipeFilterValues } from '@/features/recipes/components/recipe-filters';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { screenScrollProps } from '@/components/screen-scroll-props';
import { useDatabase } from '@/db/database-context';
import { ReadingPhoto } from '@/features/recipes/components/reading-photo';
import {
  NO_FILTERS,
  RecipeFilters,
  toQueryFilters,
} from '@/features/recipes/components/recipe-filters';
import { pickRandomRecipeId } from '@/features/recipes/db/recipe-queries';
import { useNewRecipe } from '@/features/recipes/hooks/use-new-recipe';
import { useRecipe, useRecipeCount } from '@/features/recipes/hooks/use-recipes';
import { usePreferences } from '@/features/settings/preferences';
import { ShoppingListButton } from '@/features/shopping-list/components/shopping-list-button';
import { addPick, getPicks, usePicks } from '@/features/shopping-list/meal-picks';
import { SyncStatusButton } from '@/features/sync/components/sync-status-button';
import { useMessages } from '@/i18n/i18n-provider';
import { startOfLastDays } from '@/lib/dates';
import { isTv } from '@/lib/device';
import { SuggestionCard } from './components/suggestion-card';

// A main course unless asked otherwise; any season. The ingredients are filtered in the recipe list.
const INITIAL_FILTERS: RecipeFilterValues = { ...NO_FILTERS, course: 'main' };

// Proposes a random recipe of the chosen season and course, and another one on request, skipping
// the recipes cooked in the last days (Settings › Skip recent meals) while others match, and those
// already in the shopping list (a suggestion can be added to it, which proposes another one).
export function MealChoiceScreen() {
  const t = useMessages();
  const newRecipe = useNewRecipe();
  const database = useDatabase();
  const { recentMealDays } = usePreferences();
  const pickList = usePicks();
  const [filterValues, setFilterValues] = useState(INITIAL_FILTERS);
  const pick = (values: RecipeFilterValues, excludedId?: number) =>
    pickRandomRecipeId(database, toQueryFilters(values, ''), {
      excludedId,
      // Read when picking: a meal just added to the list is left out at once.
      omittedIdList: getPicks(),
      skipCookedSince: recentMealDays === 0 ? undefined : startOfLastDays(recentMealDays),
    });
  // A recipe is proposed as soon as the screen opens (reads are synchronous).
  const [suggestedId, setSuggestedId] = useState(() => pick(INITIAL_FILTERS));
  const recipeCount = useRecipeCount({ ingredientIdList: [] });
  const matchCount = useRecipeCount(toQueryFilters(filterValues, ''));
  // Undefined once the suggested recipe is deleted.
  const suggestion = useRecipe(suggestedId);

  const suggestAnother = () => setSuggestedId(pick(filterValues, suggestedId));
  const addToList = (recipeId: number) => {
    addPick(recipeId);
    setSuggestedId(pick(filterValues, recipeId));
  };
  // Other filters: a matching recipe right away.
  const changeFilters = (values: RecipeFilterValues) => {
    setFilterValues(values);
    setSuggestedId(pick(values));
  };

  // Disabled while there's no recipe to suggest (none yet, or none matching the filters).
  const headerButton = (
    <Button
      accessibilityHint={t.mealChoice.suggestHint}
      accessibilityLabel={suggestion ? t.mealChoice.suggestAnother : t.mealChoice.suggestRecipe}
      icon="dice-multiple"
      isDisabled={matchCount === 0}
      label={t.mealChoice.suggest}
      onPress={suggestAnother}
    />
  );
  const header = (
    <Drawer.Screen
      options={{
        headerRight: headerActions(
          <>
            <SyncStatusButton />
            <ShoppingListButton />
            {headerButton}
          </>,
        ),
      }}
    />
  );

  if (recipeCount === 0) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          message={isTv ? t.recipes.emptyMessageOnTv : t.mealChoice.emptyMessage}
          title={t.recipes.emptyTitle}
        >
          {/* Read-only on a TV: recipes are written on the phone. */}
          {!isTv && (
            <Button
              accessibilityHint={t.recipes.newHint}
              icon="plus"
              isDisabled={newRecipe.isReading}
              label={t.mealChoice.createRecipe}
              onPress={newRecipe.start}
            />
          )}
          <ReadingPhoto isReading={newRecipe.isReading} />
        </EmptyState>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen} {...screenScrollProps}>
      {header}
      <RecipeFilters isIngredientPickerHidden onChange={changeFilters} values={filterValues} />
      {matchCount === 0 && (
        <Text accessibilityLiveRegion="polite" style={styles.noMatch}>
          {t.recipes.matchCount(0)}
        </Text>
      )}
      {matchCount > 0 &&
        (suggestion ? (
          <SuggestionCard
            onAddToList={isTv ? undefined : addToList}
            onAnother={suggestAnother}
            recipe={suggestion}
          />
        ) : (
          // Every match in the shopping list, recipes added after the screen opened, or the
          // suggested one deleted.
          <EmptyState
            message={
              suggestedId === undefined && pickList.length > 0
                ? t.mealChoice.allPicked
                : t.mealChoice.promptMessage(matchCount)
            }
            title={t.mealChoice.promptTitle}
          />
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    // Centered on wide screens (TV).
    alignSelf: 'center',
    gap: theme.gap(5),
    maxWidth: theme.size.maxContent,
    padding: theme.gap(4),
    width: '100%',
  },
  noMatch: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
}));
