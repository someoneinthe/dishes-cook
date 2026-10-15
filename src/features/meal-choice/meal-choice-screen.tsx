import { router } from 'expo-router';
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
import {
  NO_FILTERS,
  RecipeFilters,
  toQueryFilters,
} from '@/features/recipes/components/recipe-filters';
import { pickRandomRecipeId } from '@/features/recipes/db/recipe-queries';
import { useRecipe, useRecipeCount } from '@/features/recipes/hooks/use-recipes';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import { SuggestionCard } from './components/suggestion-card';

// A main course unless asked otherwise; any season. The ingredients are filtered in the recipe list.
const INITIAL_FILTERS: RecipeFilterValues = { ...NO_FILTERS, course: 'main' };

// Proposes a random recipe of the chosen season and course, and another one on request.
export function MealChoiceScreen() {
  const t = useMessages();
  const database = useDatabase();
  const [filterValues, setFilterValues] = useState(INITIAL_FILTERS);
  const pick = (values: RecipeFilterValues, excludedId?: number) =>
    pickRandomRecipeId(database, toQueryFilters(values, ''), excludedId);
  // A recipe is proposed as soon as the screen opens (reads are synchronous).
  const [suggestedId, setSuggestedId] = useState(() => pick(INITIAL_FILTERS));
  const recipeCount = useRecipeCount({ ingredientIdList: [] });
  const matchCount = useRecipeCount(toQueryFilters(filterValues, ''));
  // Undefined once the suggested recipe is deleted.
  const suggestion = useRecipe(suggestedId);

  const suggestAnother = () => setSuggestedId(pick(filterValues, suggestedId));
  // Other filters: a matching recipe right away.
  const changeFilters = (values: RecipeFilterValues) => {
    setFilterValues(values);
    setSuggestedId(pick(values));
  };

  // Read-only on a TV: recipes are written on the phone, so there's nothing to add there.
  const newRecipeButton = isTv ? null : (
    <Button
      accessibilityHint={t.recipes.newHint}
      accessibilityLabel={t.mealChoice.addRecipe}
      icon="plus"
      isIconOnly
      label={t.recipes.new}
      onPress={() => router.push('/recipe/new')}
    />
  );
  const headerButton =
    recipeCount === 0 ? (
      newRecipeButton
    ) : (
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
      options={{ headerRight: headerButton ? headerActions(headerButton) : undefined }}
    />
  );

  if (recipeCount === 0) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          message={isTv ? t.recipes.emptyMessageOnTv : t.mealChoice.emptyMessage}
          title={t.recipes.emptyTitle}
        />
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
          <SuggestionCard onAnother={suggestAnother} recipe={suggestion} />
        ) : (
          // Recipes added after the screen opened, or the suggested one deleted.
          <EmptyState
            message={t.mealChoice.promptMessage(matchCount)}
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
