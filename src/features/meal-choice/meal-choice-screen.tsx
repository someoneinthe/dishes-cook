import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { RecipeFilters } from '@/features/recipes/db/recipe-queries';
import type { Messages } from '@/i18n/en';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { SegmentedControl } from '@/components/segmented-control';
import { useDatabase } from '@/db/database-context';
import { IngredientPicker } from '@/features/ingredients/components/ingredient-picker';
import { courseOptionList } from '@/features/recipes/course';
import { pickRandomRecipeId } from '@/features/recipes/db/recipe-queries';
import { useRecipe, useRecipeCount } from '@/features/recipes/hooks/use-recipes';
import { SEASON_ICONS } from '@/features/recipes/season';
import { useMessages } from '@/i18n/i18n-provider';
import { SuggestionCard } from './components/suggestion-card';

type CourseFilter = 'any' | NonNullable<RecipeFilters['course']>;
type SeasonFilter = 'any' | NonNullable<RecipeFilters['season']>;

// Picks a random recipe among those matching the filters.
export function MealChoiceScreen() {
  const t = useMessages();
  const [season, setSeason] = useState<SeasonFilter>('any');
  const [course, setCourse] = useState<CourseFilter>('any');
  const [selectedIngredientList, setSelectedIngredientList] = useState<Ingredient[]>([]);
  const [suggestedId, setSuggestedId] = useState<number>();

  const database = useDatabase();
  const filters = {
    course: course === 'any' ? undefined : course,
    ingredientIdList: selectedIngredientList.map((ingredient) => ingredient.id),
    season: season === 'any' ? undefined : season,
  };
  // Counts only: a recipe is read when one is picked.
  const matchCount = useRecipeCount(filters);
  const recipeCount = useRecipeCount({ ingredientIdList: [] });
  const suggestion = useRecipe(suggestedId);

  const suggestAnother = () => setSuggestedId(pickRandomRecipeId(database, filters, suggestedId));

  const headerButton =
    recipeCount === 0 ? (
      <Button
        accessibilityHint={t.recipes.newHint}
        accessibilityLabel={t.mealChoice.addRecipe}
        icon="plus"
        isIconOnly
        label={t.recipes.new}
        onPress={() => router.push('/recipe/new')}
      />
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
  const header = <Drawer.Screen options={{ headerRight: headerActions(headerButton) }} />;

  if (recipeCount === 0) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState message={t.mealChoice.emptyMessage} title={t.recipes.emptyTitle} />
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
      {suggestion && <SuggestionCard onAnother={suggestAnother} recipe={suggestion} />}
      <SegmentedControl
        label={t.recipes.season}
        onChange={(value) => {
          setSeason(value);
          setSuggestedId(undefined);
        }}
        optionList={seasonFilterOptionList(t)}
        value={season}
      />
      <SegmentedControl
        label={t.recipes.course}
        onChange={(value) => {
          setCourse(value);
          setSuggestedId(undefined);
        }}
        optionList={courseFilterOptionList(t)}
        value={course}
      />
      <IngredientPicker
        emptyMessage={t.mealChoice.noUsedIngredient}
        isUsedOnly
        label={t.mealChoice.withIngredients}
        onChange={(ingredientList) => {
          setSelectedIngredientList(ingredientList);
          setSuggestedId(undefined);
        }}
        selectedList={selectedIngredientList}
      />
      <Text accessibilityLiveRegion="polite" style={styles.matchCount}>
        {t.mealChoice.matchCount(matchCount)}
      </Text>
    </ScrollView>
  );
}

function courseFilterOptionList(t: Messages): readonly SegmentedOption<CourseFilter>[] {
  return [{ label: t.mealChoice.any, value: 'any' }, ...courseOptionList(t)];
}

function seasonFilterOptionList(t: Messages): readonly SegmentedOption<SeasonFilter>[] {
  return [
    { label: t.mealChoice.any, value: 'any' },
    { ...SEASON_ICONS.winter, label: t.seasons.winter, value: 'winter' },
    { ...SEASON_ICONS.summer, label: t.seasons.summer, value: 'summer' },
  ];
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
}));
