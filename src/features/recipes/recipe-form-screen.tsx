import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Course, Season } from '@/db/schema';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { Messages } from '@/i18n/en';
import type { Quantity, UnitSystem } from '@/lib/units';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { useDatabase } from '@/db/database-context';
import { IngredientPicker } from '@/features/ingredients/components/ingredient-picker';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { usePreferences } from '@/features/settings/preferences';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import { cleanName } from '@/lib/text';
import { formatAmount, parseAmount, toDisplay } from '@/lib/units';
import type { QuantityDraft } from './components/ingredient-quantity-row';
import type { Recipe } from './db/recipe-queries';
import { IngredientQuantityRow } from './components/ingredient-quantity-row';
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
  const { units } = usePreferences();
  // The saved quantities, as shown (Settings › Units) and as stored, by ingredient id.
  const [savedMap] = useState(() => savedQuantities(initialRecipe, t, units));
  // Quantities as typed, by ingredient id (kept when an ingredient is removed then added back).
  const [draftMap, setDraftMap] = useState(
    () => new Map([...savedMap].map(([id, { draft }]) => [id, draft])),
  );
  // Ingredients whose amount isn't a number, shown after a save attempt.
  const [invalidIdSet, setInvalidIdSet] = useState<ReadonlySet<number>>(new Set());

  const save = () => {
    const { invalidIdList, quantities } = readQuantities(
      selectedIngredientList,
      draftMap,
      savedMap,
    );
    setInvalidIdSet(new Set(invalidIdList));
    if (!cleanName(title)) {
      setTitleError(t.recipes.titleRequired);
    }
    if (!cleanName(title) || invalidIdList.length > 0) {
      return;
    }
    const input = {
      course,
      ingredientIdList: selectedIngredientList.map((ingredient) => ingredient.id),
      instructions,
      quantities,
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
        renderSelected={(ingredient, remove) => (
          <IngredientQuantityRow
            draft={draftMap.get(ingredient.id) ?? EMPTY_DRAFT}
            error={invalidIdSet.has(ingredient.id) ? t.quantities.invalidAmount : undefined}
            ingredient={ingredient}
            onChange={(draft) => {
              setDraftMap((previous) => new Map(previous).set(ingredient.id, draft));
              if (invalidIdSet.has(ingredient.id)) {
                setInvalidIdSet((previous) => withoutId(previous, ingredient.id));
              }
            }}
            onRemove={remove}
          />
        )}
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

const EMPTY_DRAFT: QuantityDraft = { amountText: '' };

// A row of the form, read when saving.
type RowReading = Readonly<{ isInvalid: boolean; quantity?: Quantity }>;

type SavedQuantity = Readonly<{ draft: QuantityDraft; stored: Quantity }>;

// The quantities of the selected ingredients; an empty amount = no quantity.
function readQuantities(
  selectedList: readonly Ingredient[],
  draftMap: ReadonlyMap<number, QuantityDraft>,
  savedMap: ReadonlyMap<number, SavedQuantity>,
): Readonly<{ invalidIdList: number[]; quantities: Map<number, Quantity> }> {
  const invalidIdList: number[] = [];
  const quantities = new Map<number, Quantity>();
  for (const { id } of selectedList) {
    const { isInvalid, quantity } = readRow(draftMap.get(id) ?? EMPTY_DRAFT, savedMap.get(id));
    if (isInvalid) {
      invalidIdList.push(id);
    }
    if (quantity) {
      quantities.set(id, quantity);
    }
  }
  return { invalidIdList, quantities };
}

// One row: left as shown, its stored quantity; edited, as typed; nothing when empty.
function readRow(draft: QuantityDraft, saved: SavedQuantity | undefined): RowReading {
  if (draft.amountText === saved?.draft.amountText && draft.unit === saved.draft.unit) {
    return { isInvalid: false, quantity: saved.stored };
  }
  const amount = parseAmount(draft.amountText);
  if (amount === undefined) {
    return { isInvalid: draft.amountText.trim() !== '' };
  }
  return {
    isInvalid: false,
    quantity: draft.unit === undefined ? { amount } : { amount, unit: draft.unit },
  };
}

// The saved quantities: as the form shows them (in the reader's units, "1,5" in French), and as
// stored, kept for the rows the user doesn't touch (a display rounds: 226.8 g shows as 227 g).
function savedQuantities(
  recipe: Recipe | undefined,
  t: Messages,
  units: UnitSystem,
): Map<number, SavedQuantity> {
  const savedMap = new Map<number, SavedQuantity>();
  const ingredientList = recipe?.ingredientList ?? [];
  for (const { id, quantity } of ingredientList) {
    const saved = quantity && toSaved(quantity, t, units);
    if (saved) {
      savedMap.set(id, saved);
    }
  }
  return savedMap;
}

// A stored quantity, and how the form shows it.
function toSaved(quantity: Quantity, t: Messages, units: UnitSystem): SavedQuantity {
  const shown = toDisplay(quantity, units);
  return {
    draft: {
      amountText: formatAmount(shown.amount, t.quantities.decimalSeparator),
      unit: shown.unit,
    },
    stored: quantity,
  };
}

function withoutId(idSet: ReadonlySet<number>, id: number): ReadonlySet<number> {
  const next = new Set(idSet);
  next.delete(id);
  return next;
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
