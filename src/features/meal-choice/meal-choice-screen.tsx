import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { RecipeFilters } from '@/features/recipes/db/recipe-queries';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { SegmentedControl } from '@/components/segmented-control';
import { useDatabase } from '@/db/database-context';
import { IngredientPicker } from '@/features/ingredients/components/ingredient-picker';
import { RecipeDetails } from '@/features/recipes/components/recipe-details';
import { pickRandomRecipeId } from '@/features/recipes/db/recipe-queries';
import { useRecipe, useRecipeCount } from '@/features/recipes/hooks/use-recipes';
import { SEASON_ICONS } from '@/features/recipes/season';

type SeasonFilter = 'any' | NonNullable<RecipeFilters['season']>;

const SEASON_FILTER_OPTION_LIST: readonly SegmentedOption<SeasonFilter>[] = [
  { label: 'Any', value: 'any' },
  { ...SEASON_ICONS.winter, label: 'Winter', value: 'winter' },
  { ...SEASON_ICONS.summer, label: 'Summer', value: 'summer' },
];

// Picks a random recipe among those matching the filters.
export function MealChoiceScreen() {
  const [season, setSeason] = useState<SeasonFilter>('any');
  const [selectedIngredientList, setSelectedIngredientList] = useState<Ingredient[]>([]);
  const [suggestedId, setSuggestedId] = useState<number>();

  const database = useDatabase();
  const filters = {
    ingredientIdList: selectedIngredientList.map((ingredient) => ingredient.id),
    season: season === 'any' ? undefined : season,
  };
  // Counts only: a recipe is read when one is picked.
  const matchCount = useRecipeCount(filters);
  const recipeCount = useRecipeCount({ ingredientIdList: [] });
  const suggestion = useRecipe(suggestedId);

  const headerButton =
    recipeCount === 0 ? (
      <Button
        accessibilityHint="Opens an empty recipe form"
        accessibilityLabel="Add a recipe"
        icon="plus"
        isIconOnly
        label="New"
        onPress={() => router.push('/recipe/new')}
      />
    ) : (
      <Button
        accessibilityHint="Picks a random recipe among the matching ones"
        accessibilityLabel={suggestion ? 'Suggest another one' : 'Suggest a recipe'}
        icon="dice-multiple"
        isDisabled={matchCount === 0}
        label="Suggest"
        onPress={() => setSuggestedId(pickRandomRecipeId(database, filters, suggestedId))}
      />
    );
  const header = <Drawer.Screen options={{ headerRight: headerActions(headerButton) }} />;

  if (recipeCount === 0) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          message="Add a few recipes, then come back to let chance decide what to eat."
          title="No recipes yet"
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      {header}
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
        emptyMessage="No ingredient is used by a recipe yet."
        isUsedOnly
        label="With ingredients"
        onChange={(ingredientList) => {
          setSelectedIngredientList(ingredientList);
          setSuggestedId(undefined);
        }}
        selectedList={selectedIngredientList}
      />
      <Text accessibilityLiveRegion="polite" style={styles.matchCount}>
        {describeMatchCount(matchCount)}
      </Text>
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
