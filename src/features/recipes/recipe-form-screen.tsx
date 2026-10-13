import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Season } from '@/db/schema';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { useDatabase } from '@/db/database-context';
import { IngredientPicker } from '@/features/ingredients/components/ingredient-picker';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { cleanName } from '@/lib/text';
import type { Recipe } from './db/recipe-queries';
import { getRecipe, saveRecipe } from './db/recipe-queries';
import { SEASON_OPTION_LIST } from './season';

type RecipeFormProps = Readonly<{
  // Undefined for a new recipe.
  initialRecipe: Recipe | undefined;
  screenTitle: string;
}>;

// Creates a recipe (/recipe/new) or edits one (/recipe/[id]/edit).
export function RecipeFormScreen() {
  const database = useDatabase();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const recipeId = id === undefined ? undefined : Number(id);
  // The form starts from the saved recipe; reads are synchronous, so it's ready on first render.
  const [initialRecipe] = useState(() =>
    recipeId === undefined ? undefined : getRecipe(database, recipeId),
  );
  const screenTitle = recipeId === undefined ? 'New recipe' : 'Edit recipe';

  if (recipeId !== undefined && !initialRecipe) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: screenTitle }} />
        <EmptyState message="It may have been deleted." title="Recipe not found" />
      </View>
    );
  }
  return <RecipeForm initialRecipe={initialRecipe} screenTitle={screenTitle} />;
}

function RecipeForm({ initialRecipe, screenTitle }: RecipeFormProps) {
  const database = useDatabase();
  const [title, setTitle] = useState(initialRecipe?.title ?? '');
  const [season, setSeason] = useState<Season>(initialRecipe?.season ?? 'both');
  const [selectedIngredientList, setSelectedIngredientList] = useState<Ingredient[]>(
    initialRecipe?.ingredientList ?? [],
  );
  const [instructions, setInstructions] = useState(initialRecipe?.instructions ?? '');
  const [titleError, setTitleError] = useState<string>();

  const save = () => {
    if (!cleanName(title)) {
      setTitleError('Give the recipe a title.');
      return;
    }
    const input = {
      ingredientIdList: selectedIngredientList.map((ingredient) => ingredient.id),
      instructions,
      season,
      title,
    };
    if (initialRecipe) {
      saveRecipe(database, input, initialRecipe.id);
      router.back();
    } else {
      const newId = saveRecipe(database, input);
      router.replace({ params: { id: String(newId) }, pathname: '/recipe/[id]' });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <Stack.Screen
        options={{
          headerRight: headerActions(
            <Button
              accessibilityHint="Saves the recipe and shows it"
              accessibilityLabel="Save recipe"
              icon="content-save"
              isIconOnly
              label="Save"
              onPress={save}
            />,
          ),
          title: screenTitle,
        }}
      />
      <TextField
        error={titleError}
        label="Title"
        onChangeText={(text) => {
          setTitle(text);
          setTitleError(undefined);
        }}
        placeholder="e.g. Pumpkin soup"
        value={title}
      />
      <SegmentedControl
        label="Season"
        onChange={setSeason}
        optionList={SEASON_OPTION_LIST}
        value={season}
      />
      <IngredientPicker
        emptyMessage="Type an ingredient to add it."
        label="Ingredients"
        onChange={setSelectedIngredientList}
        onCreate={(name) => {
          const { id, name: createdName } = findOrCreateIngredient(database, name);
          return { id, name: createdName };
        }}
        selectedList={selectedIngredientList}
      />
      <TextField
        label="Recipe"
        multiline
        onChangeText={setInstructions}
        placeholder="Steps, quantities, cooking time…"
        value={instructions}
      />
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
