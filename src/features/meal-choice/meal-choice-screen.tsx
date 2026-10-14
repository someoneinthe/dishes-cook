import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { RecipeFilters } from '@/features/recipes/db/recipe-queries';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { useDatabase } from '@/db/database-context';
import { pickRandomRecipeId } from '@/features/recipes/db/recipe-queries';
import { useRecipe, useRecipeCount } from '@/features/recipes/hooks/use-recipes';
import { useMessages } from '@/i18n/i18n-provider';
import { SuggestionCard } from './components/suggestion-card';

// Every recipe: the meal choice has no filters (the recipe list does).
const ALL_RECIPES: RecipeFilters = { ingredientIdList: [] };

// Proposes a random recipe, and another one on request.
export function MealChoiceScreen() {
  const t = useMessages();
  const database = useDatabase();
  // A recipe is proposed as soon as the screen opens (reads are synchronous).
  const [suggestedId, setSuggestedId] = useState(() => pickRandomRecipeId(database, ALL_RECIPES));
  const recipeCount = useRecipeCount(ALL_RECIPES);
  // Undefined once the suggested recipe is deleted.
  const suggestion = useRecipe(suggestedId);

  const suggestAnother = () =>
    setSuggestedId(pickRandomRecipeId(database, ALL_RECIPES, suggestedId));

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
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      {header}
      {suggestion ? (
        <SuggestionCard onAnother={suggestAnother} recipe={suggestion} />
      ) : (
        // Recipes added after the screen opened, or the suggested one deleted.
        <EmptyState
          message={t.mealChoice.promptMessage(recipeCount)}
          title={t.mealChoice.promptTitle}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.gap(5),
    padding: theme.gap(4),
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
}));
