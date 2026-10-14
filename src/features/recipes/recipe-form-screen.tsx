import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Course, Season } from '@/db/schema';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { useDatabase } from '@/db/database-context';
import { IngredientPicker } from '@/features/ingredients/components/ingredient-picker';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import { cleanName } from '@/lib/text';
import type { Recipe } from './db/recipe-queries';
import { InstructionsField } from './components/instructions-field';
import { courseOptionList } from './course';
import { getRecipe, saveRecipe } from './db/recipe-queries';
import { seasonOptionList } from './season';

type RecipeFormProps = Readonly<{
  // Undefined for a new recipe.
  initialRecipe: Recipe | undefined;
  screenTitle: string;
}>;

// Read-only on a TV: a link to the form (/recipe/new, /recipe/[id]/edit) leads to the meal choice.
export function RecipeFormScreen() {
  // Sonar (S100) only sees a component when it returns a JSX element, not a ternary.
  // eslint-disable-next-line unicorn/prefer-ternary
  if (isTv) {
    return <Redirect href="/" />;
  }
  return <RecipeFormRoute />;
}

function RecipeForm({ initialRecipe, screenTitle }: RecipeFormProps) {
  const database = useDatabase();
  const t = useMessages();
  const [title, setTitle] = useState(initialRecipe?.title ?? '');
  const [season, setSeason] = useState<Season>(initialRecipe?.season ?? 'both');
  // Every recipe has a course: a main course unless chosen otherwise.
  const [course, setCourse] = useState<Course>(initialRecipe?.course ?? 'main');
  const [selectedIngredientList, setSelectedIngredientList] = useState<Ingredient[]>(
    initialRecipe?.ingredientList ?? [],
  );
  const [instructions, setInstructions] = useState(initialRecipe?.instructions ?? '');
  const [titleError, setTitleError] = useState<string>();

  const save = () => {
    if (!cleanName(title)) {
      setTitleError(t.recipes.titleRequired);
      return;
    }
    const input = {
      course,
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
              accessibilityHint={t.recipes.saveHint}
              accessibilityLabel={t.recipes.saveRecipe}
              icon="check"
              isIconOnly
              label={t.common.save}
              onPress={save}
            />,
          ),
          title: screenTitle,
        }}
      />
      <TextField
        error={titleError}
        label={t.recipes.title}
        onChangeText={(text) => {
          setTitle(text);
          setTitleError(undefined);
        }}
        placeholder={t.recipes.titlePlaceholder}
        value={title}
      />
      <SegmentedControl
        label={t.recipes.season}
        onChange={setSeason}
        optionList={seasonOptionList(t)}
        value={season}
      />
      <SegmentedControl
        label={t.recipes.course}
        onChange={setCourse}
        optionList={courseOptionList(t)}
        value={course}
      />
      <IngredientPicker
        emptyMessage={t.recipes.ingredientsEmpty}
        label={t.recipes.ingredients}
        onChange={setSelectedIngredientList}
        onCreate={(name) => {
          const { id, name: createdName } = findOrCreateIngredient(database, name);
          return { id, name: createdName };
        }}
        selectedList={selectedIngredientList}
      />
      <InstructionsField onChange={setInstructions} value={instructions} />
    </ScrollView>
  );
}

// Creates a recipe (/recipe/new) or edits one (/recipe/[id]/edit).
function RecipeFormRoute() {
  const database = useDatabase();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const recipeId = id === undefined ? undefined : Number(id);
  // The form starts from the saved recipe; reads are synchronous, so it's ready on first render.
  const [initialRecipe] = useState(() =>
    recipeId === undefined ? undefined : getRecipe(database, recipeId),
  );
  const t = useMessages();
  const screenTitle = recipeId === undefined ? t.recipes.newRecipe : t.recipes.editRecipe;

  if (recipeId !== undefined && !initialRecipe) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: screenTitle }} />
        <EmptyState message={t.recipes.notFoundMessage} title={t.recipes.notFoundTitle} />
      </View>
    );
  }
  return <RecipeForm initialRecipe={initialRecipe} screenTitle={screenTitle} />;
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
