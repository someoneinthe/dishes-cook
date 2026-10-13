import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { RecipeFilters } from '@/features/recipes/db/recipe-queries';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { SegmentedControl } from '@/components/segmented-control';
import { useLiveQuery } from '@/db/use-live-query';
import { IngredientPicker } from '@/features/ingredients/components/ingredient-picker';
import { useIngredientList } from '@/features/ingredients/hooks/use-ingredient-list';
import { sortByUsage } from '@/features/ingredients/sort-by-usage';
import { RecipeDetails } from '@/features/recipes/components/recipe-details';
import { findRecipeIds, RECIPE_TABLES } from '@/features/recipes/db/recipe-queries';
import { useHasAnyRecipe, useRecipe } from '@/features/recipes/hooks/use-recipes';
import { pickRandomId } from './pick-random-id';

type SeasonFilter = 'any' | NonNullable<RecipeFilters['season']>;

const SEASON_FILTER_OPTION_LIST: readonly SegmentedOption<SeasonFilter>[] = [
  { label: 'Any', value: 'any' },
  { label: 'Winter', value: 'winter' },
  { label: 'Summer', value: 'summer' },
];

// Picks a random recipe among those matching the filters.
export function MealChoiceScreen() {
  const [season, setSeason] = useState<SeasonFilter>('any');
  const [selectedIngredientList, setSelectedIngredientList] = useState<Ingredient[]>([]);
  const [suggestedId, setSuggestedId] = useState<number>();

  // Only ingredients some recipe uses can narrow the choice; the most used are suggested first.
  const usedIngredientList = sortByUsage(
    useIngredientList().filter((ingredient) => ingredient.recipeCount > 0),
  );
  // Just the ids (cheap, index-only): the full recipe is read once one is picked.
  const matchingIdList = useLiveQuery(
    (database) =>
      findRecipeIds(database, {
        ingredientIdList: selectedIngredientList.map((ingredient) => ingredient.id),
        season: season === 'any' ? undefined : season,
      }),
    [season, selectedIngredientList],
    RECIPE_TABLES,
  );
  const hasRecipes = useHasAnyRecipe();
  const suggestion = useRecipe(suggestedId);

  if (!hasRecipes) {
    return (
      <View style={styles.screen}>
        <EmptyState
          message="Add a few recipes, then come back to let chance decide what to eat."
          title="No recipes yet"
        >
          <Button label="Add a recipe" onPress={() => router.push('/recipe/new')} />
        </EmptyState>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <SegmentedControl
        label="Season"
        onChange={(value) => {
          setSeason(value);
          setSuggestedId(undefined);
        }}
        optionList={SEASON_FILTER_OPTION_LIST}
        value={season}
      />
      <IngredientPicker
        availableList={usedIngredientList}
        emptyMessage="No ingredient is used by a recipe yet."
        label="With ingredients"
        onChange={(ingredientList) => {
          setSelectedIngredientList(ingredientList);
          setSuggestedId(undefined);
        }}
        selectedList={selectedIngredientList}
      />
      <Text accessibilityLiveRegion="polite" style={styles.matchCount}>
        {describeMatchCount(matchingIdList.length)}
      </Text>
      <Button
        isDisabled={matchingIdList.length === 0}
        label={suggestion ? 'Suggest another one' : 'Suggest a recipe'}
        onPress={() => setSuggestedId(pickRandomId(matchingIdList, suggestedId))}
      />
      {suggestion && (
        <View style={styles.suggestion}>
          <RecipeDetails recipe={suggestion} />
        </View>
      )}
    </ScrollView>
  );
}

function describeMatchCount(count: number): string {
  if (count === 0) {
    return 'No recipe matches these filters.';
  }
  return count === 1 ? '1 recipe matches.' : `${count} recipes match.`;
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.gap(5),
    padding: theme.gap(4),
  },
  matchCount: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  suggestion: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth,
    padding: theme.gap(4),
  },
}));
