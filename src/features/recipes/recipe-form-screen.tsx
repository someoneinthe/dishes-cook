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
import { formatAmount, parseAmount, toDisplay, toStored } from '@/lib/units';
import type { QuantityDraft } from './components/ingredient-quantity-row';
import type { Recipe } from './db/recipe-queries';
import type { AddedIngredient } from './hooks/use-new-ingredients';
import type { ScannedRecipe } from './recipe-from-text';
import { IngredientQuantityRow } from './components/ingredient-quantity-row';
import { InstructionsField } from './components/instructions-field';
import { SelectedIngredient } from './components/selected-ingredient';
import { courseOptionList } from './course';
import { getRecipe, saveRecipe } from './db/recipe-queries';
import { useNewIngredients } from './hooks/use-new-ingredients';
import { useRecipeScan } from './hooks/use-recipe-scan';
import { parseScannedRecipe } from './recipe-from-text';
import { seasonOptionList } from './season';

type RecipeFormProps = Readonly<{
  // Undefined for a new recipe.
  initialRecipe: Recipe | undefined;
  // A new recipe started from a photo (useNewRecipe): the form starts filled in with it.
  scannedRecipe: ScannedRecipe | undefined;
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

function RecipeForm({ initialRecipe, scannedRecipe, screenTitle }: RecipeFormProps) {
  const database = useDatabase();
  const t = useMessages();
  // A recipe started from a photo: its ingredients, matched to the existing ones.
  const newIngredients = useNewIngredients(scannedRecipe?.ingredientList);
  const [title, setTitle] = useState(() => startingText(initialRecipe, scannedRecipe, 'title'));
  const [season, setSeason] = useState<Season>(initialRecipe?.season ?? 'both');
  // Every recipe has a course: a main course unless chosen otherwise.
  const [course, setCourse] = useState<Course>(initialRecipe?.course ?? 'main');
  const [selectedIngredientList, setSelectedIngredientList] = useState<Ingredient[]>(
    () =>
      initialRecipe?.ingredientList ??
      newIngredients.initialAddedList.map(({ id, name }) => ({ id, name })),
  );
  const [instructions, setInstructions] = useState(() =>
    startingText(initialRecipe, scannedRecipe, 'instructions'),
  );
  const [titleError, setTitleError] = useState<string>();
  const { units } = usePreferences();
  // The saved quantities, as shown (Settings › Units) and as stored, by ingredient id.
  const [savedMap] = useState(() => savedQuantities(initialRecipe, t, units));
  // Quantities as typed, by ingredient id (kept when an ingredient is removed then added back);
  // a recipe started from a photo starts with the quantities read.
  const [draftMap, setDraftMap] = useState(() =>
    withScannedDrafts(
      new Map([...savedMap].map(([id, { draft }]) => [id, draft])),
      newIngredients.initialAddedList,
      t,
      units,
    ),
  );
  // Ingredients whose amount isn't a number, shown after a save attempt.
  const [invalidIdSet, setInvalidIdSet] = useState<ReadonlySet<number>>(new Set());
  // Save was pressed while a new ingredient looked like an existing one: the rows ask to choose.
  const [isChoiceMissing, setIsChoiceMissing] = useState(false);
  const { isReading, scan } = useRecipeScan((scanned) => {
    const addedList = newIngredients.add(scanned.ingredientList, selectedIngredientList);
    if (!cleanName(title)) {
      setTitle(scanned.title);
      setTitleError(undefined);
    }
    setSelectedIngredientList((previous) => [
      ...previous,
      ...addedList.map(({ id, name }) => ({ id, name })),
    ]);
    setDraftMap((previous) => withScannedDrafts(previous, addedList, t, units));
    setInstructions((previous) =>
      [previous.trim(), scanned.instructions].filter(Boolean).join('\n\n'),
    );
  });
  const chooseSimilar = (ingredient: Ingredient, similar: Ingredient) => {
    newIngredients.chooseSimilar(ingredient.id);
    setSelectedIngredientList((previous) => swapIngredient(previous, ingredient.id, similar));
    setDraftMap((previous) => moveDraft(previous, ingredient.id, similar.id));
  };

  const save = () => {
    const { invalidIdList, quantities } = readQuantities(
      selectedIngredientList,
      draftMap,
      savedMap,
    );
    setInvalidIdSet(new Set(invalidIdList));
    const undecidedIdList = newIngredients.undecidedIdList(selectedIngredientList);
    setIsChoiceMissing(undecidedIdList.length > 0);
    if (!cleanName(title)) {
      setTitleError(t.recipes.titleRequired);
    }
    if (!cleanName(title) || invalidIdList.length > 0 || undecidedIdList.length > 0) {
      return;
    }
    const input = {
      course,
      ingredientIdList: selectedIngredientList.map((ingredient) => ingredient.id),
      instructions,
      newIngredientNames: newIngredients.nameMap,
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
      <FormHeader
        isNew={!initialRecipe}
        isReading={isReading}
        onSave={save}
        onScan={scan}
        title={screenTitle}
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
          <SelectedIngredient
            ingredient={ingredient}
            isChoiceMissing={isChoiceMissing}
            onChooseSimilar={(similar) => chooseSimilar(ingredient, similar)}
            onKeepNew={() => newIngredients.keepNew(ingredient.id)}
            similar={newIngredients.similarOf(ingredient.id)}
          >
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
          </SelectedIngredient>
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
  const { id, scanned } = useLocalSearchParams<{ id?: string; scanned?: string }>();
  const recipeId = id === undefined ? undefined : Number(id);
  // The form starts from the saved recipe; reads are synchronous, so it's ready on first render.
  const [initialRecipe] = useState(() =>
    recipeId === undefined ? undefined : getRecipe(database, recipeId),
  );
  const [scannedRecipe] = useState(() =>
    recipeId === undefined ? parseScannedRecipe(scanned) : undefined,
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
  return (
    <RecipeForm
      initialRecipe={initialRecipe}
      scannedRecipe={scannedRecipe}
      screenTitle={screenTitle}
    />
  );
}

const EMPTY_DRAFT: QuantityDraft = { amountText: '' };

// A row of the form, read when saving.
type RowReading = Readonly<{ isInvalid: boolean; quantity?: Quantity }>;

type SavedQuantity = Readonly<{ draft: QuantityDraft; stored: Quantity }>;

// The form's header: Save, and for a new recipe, filling it in from a photo of a recipe page.
function FormHeader({
  isNew,
  isReading,
  onSave,
  onScan,
  title,
}: Readonly<{
  isNew: boolean;
  isReading: boolean;
  onSave: () => void;
  onScan: () => void;
  title: string;
}>) {
  const t = useMessages();
  return (
    <Stack.Screen
      options={{
        headerRight: headerActions(
          <>
            {isNew && (
              <Button
                accessibilityHint={t.recipeScan.buttonHint}
                accessibilityLabel={isReading ? t.recipeScan.reading : t.recipeScan.buttonLabel}
                icon="camera-outline"
                isDisabled={isReading}
                label={isReading ? t.recipeScan.reading : t.recipeScan.button}
                onPress={onScan}
                variant="secondary"
              />
            )}
            <Button
              accessibilityHint={t.recipes.saveHint}
              accessibilityLabel={t.recipes.saveRecipe}
              icon="check"
              isIconOnly
              label={t.common.save}
              onPress={onSave}
            />
          </>,
        ),
        title,
      }}
    />
  );
}

// The typed quantity follows the ingredient it was typed for, unless the other one has its own.
function moveDraft(
  draftMap: ReadonlyMap<number, QuantityDraft>,
  fromId: number,
  toId: number,
): Map<number, QuantityDraft> {
  const next = new Map(draftMap);
  const draft = draftMap.get(fromId);
  if (draft && !draftMap.get(toId)?.amountText) {
    next.set(toId, draft);
  }
  next.delete(fromId);
  return next;
}

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

// The title or the instructions the form starts with: the saved recipe's, or the photo's.
function startingText(
  recipe: Recipe | undefined,
  scanned: ScannedRecipe | undefined,
  field: 'instructions' | 'title',
): string {
  return recipe?.[field] ?? scanned?.[field] ?? '';
}

// The existing ingredient takes the new one's place, or the new one goes when it's already there.
function swapIngredient(
  selectedList: readonly Ingredient[],
  fromId: number,
  to: Ingredient,
): Ingredient[] {
  const isSelected = selectedList.some((ingredient) => ingredient.id === to.id);
  return selectedList.flatMap((ingredient) => {
    if (ingredient.id !== fromId) {
      return [ingredient];
    }
    return isSelected ? [] : [to];
  });
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

// The quantities read from a photo, in the reader's units ("2 cups" shows as 473 ml in European
// units), for the ingredients that have one.
function withScannedDrafts(
  draftMap: ReadonlyMap<number, QuantityDraft>,
  addedList: readonly AddedIngredient[],
  t: Messages,
  units: UnitSystem,
): Map<number, QuantityDraft> {
  const next = new Map(draftMap);
  for (const { id, quantity } of addedList) {
    if (quantity) {
      next.set(id, toSaved(toStored(quantity), t, units).draft);
    }
  }
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
