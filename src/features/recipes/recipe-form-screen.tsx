import type { RefObject } from 'react';
import type { Text, TextInput } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Keyboard, ScrollView, View } from 'react-native';
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
import type { TimeDrafts } from './components/recipe-time-fields';
import type { Recipe } from './db/recipe-queries';
import type { ScannedRecipe } from './recipe-from-text';
import { IngredientQuantityRow } from './components/ingredient-quantity-row';
import { InstructionsField } from './components/instructions-field';
import { RecipePhotoField } from './components/recipe-photo-field';
import { RecipeTimeFields } from './components/recipe-time-fields';
import { SelectedIngredient } from './components/selected-ingredient';
import { courseOptionList } from './course';
import { getRecipe, isRecipeSaved, saveRecipe } from './db/recipe-queries';
import { useNewIngredients } from './hooks/use-new-ingredients';
import { parseMinutes } from './minutes';
import { parseScannedRecipe } from './recipe-from-text';
import { deleteRecipePhoto } from './recipe-photos';
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
    () => initialRecipe?.ingredientList ?? newIngredients.initial.addedList,
  );
  const [instructions, setInstructions] = useState(() =>
    startingText(initialRecipe, scannedRecipe, 'instructions'),
  );
  const [titleError, setTitleError] = useState<string>();
  const [timeDrafts, setTimeDrafts] = useState<TimeDrafts>(() => ({
    cook: initialRecipe?.cookMinutes === undefined ? '' : String(initialRecipe.cookMinutes),
    prep: initialRecipe?.prepMinutes === undefined ? '' : String(initialRecipe.prepMinutes),
  }));
  const [invalidTimeList, setInvalidTimeList] = useState<(keyof TimeDrafts)[]>([]);
  // The photo's file; one picked here is saved with the recipe, or swept at start if not.
  const [photoFile, setPhotoFile] = useState(initialRecipe?.photoFile);
  const changePhoto = (file: string | undefined) => {
    // A photo picked here and replaced or removed before saving: no recipe will have it.
    if (photoFile !== undefined && photoFile !== initialRecipe?.photoFile) {
      deleteRecipePhoto(photoFile);
    }
    setPhotoFile(file);
  };
  const { units } = usePreferences();
  // The saved quantities, as shown (Settings › Units) and as stored, by ingredient id.
  const [savedMap] = useState(() => savedQuantities(initialRecipe, t, units));
  // Quantities as typed, by ingredient id (kept when an ingredient is removed then added back);
  // a recipe started from a photo starts with the quantities read.
  const [draftMap, setDraftMap] = useState(() =>
    withScannedDrafts(
      new Map([...savedMap].map(([id, { draft }]) => [id, draft])),
      newIngredients.initial.quantityList,
      t,
      units,
    ),
  );
  // Ingredients whose amount isn't a number, shown after a save attempt.
  const [invalidIdSet, setInvalidIdSet] = useState<ReadonlySet<number>>(new Set());
  // Save was pressed while a new ingredient looked like an existing one: the rows ask to choose.
  const [isChoiceMissing, setIsChoiceMissing] = useState(false);
  // Set once saved: a second tap on Save, before the screen closes, saves nothing more.
  const isSavedRef = useRef(false);
  // The fields Save can find wrong, to bring the first one into view.
  const scrollViewRef = useRef<ScrollView>(null);
  // ScrollView's `innerViewRef` is typed as never empty, which a ref is before mounting.
  const contentRef = useRef<View>(null) as RefObject<View>;
  const titleRef = useRef<TextInput>(null);
  const keepAtTop = useKeepAtTop(scrollViewRef, contentRef);
  const amountRefMap = useRef(new Map<number, TextInput>());
  const choiceRefMap = useRef(new Map<number, Text>());
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
    const { cookMinutes, invalidList: timeErrorList, prepMinutes } = readTimes(timeDrafts);
    setInvalidTimeList(timeErrorList);
    const firstInvalid = firstInvalidField({
      amountRefMap: amountRefMap.current,
      choiceRefMap: choiceRefMap.current,
      invalidIdList,
      selectedList: selectedIngredientList,
      titleInput: cleanName(title) ? undefined : titleRef.current,
      undecidedIdList,
    });
    if (firstInvalid) {
      // Once its error shows: scrolled to, and given the focus (a field opens the keyboard).
      requestAnimationFrame(() =>
        showField(firstInvalid, scrollViewRef.current, contentRef.current),
      );
    }
    if (
      isSavedRef.current ||
      !cleanName(title) ||
      invalidIdList.length > 0 ||
      undecidedIdList.length > 0 ||
      timeErrorList.length > 0
    ) {
      return;
    }
    const input = {
      cookMinutes,
      course,
      ingredientIdList: selectedIngredientList.map((ingredient) => ingredient.id),
      instructions,
      newIngredientNames: newIngredients.nameMap,
      ...photoInput(photoFile, initialRecipe?.photoFile),
      prepMinutes,
      quantities,
      season,
      title,
    };
    // Saved first, then marked and left: if saving throws, the form stays, and Save works again.
    const saveAsNew = () => {
      // A new row: its photo is the one shown, changed or not.
      const newId = saveRecipe(database, {
        ...input,
        photo: photoFile === undefined ? null : { file: photoFile },
      });
      isSavedRef.current = true;
      return newId;
    };
    const showRecipe = (id: number) => {
      router.replace({ params: { id: String(id) }, pathname: '/recipe/[id]' });
    };
    if (!initialRecipe) {
      showRecipe(saveAsNew());
      return;
    }
    // Deleted meanwhile, on another device (pulled by a sync): the edits aren't lost.
    if (!isRecipeSaved(database, initialRecipe.id)) {
      Alert.alert(t.recipes.deletedWhileEditingTitle, t.recipes.deletedWhileEditingMessage, [
        { style: 'cancel', text: t.common.cancel },
        {
          onPress: () => {
            // Two alerts if Save was tapped twice before the first showed: saved once.
            if (isSavedRef.current) {
              return;
            }
            const newId = saveAsNew();
            // Back to the deleted recipe's screen, which then shows the new one instead.
            router.back();
            showRecipe(newId);
          },
          text: t.recipes.saveAsNew,
        },
      ]);
      return;
    }
    saveRecipe(database, input, initialRecipe.id);
    isSavedRef.current = true;
    deleteReplacedPhoto(initialRecipe.photoFile, photoFile);
    router.back();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      innerViewRef={contentRef}
      keyboardShouldPersistTaps="handled"
      ref={scrollViewRef}
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
        ref={titleRef}
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
      <RecipeTimeFields
        drafts={timeDrafts}
        invalidList={invalidTimeList}
        onChange={(drafts) => {
          setTimeDrafts(drafts);
          setInvalidTimeList([]);
        }}
      />
      <IngredientPicker
        emptyMessage={t.recipes.ingredientsEmpty}
        label={t.recipes.ingredients}
        onChange={setSelectedIngredientList}
        onCreate={(name) => {
          const { id, name: createdName } = findOrCreateIngredient(database, name);
          return { id, name: createdName };
        }}
        // At the top of the page: its suggestions, under it, show above the keyboard.
        onSearchFocus={keepAtTop}
        renderSelected={(ingredient, remove) => (
          <SelectedIngredient
            choiceRef={(text) => keepRef(choiceRefMap.current, ingredient.id, text)}
            ingredient={ingredient}
            isChoiceMissing={isChoiceMissing}
            onChooseSimilar={(similar) => chooseSimilar(ingredient, similar)}
            onKeepNew={() => newIngredients.keepNew(ingredient.id)}
            similar={newIngredients.similarOf(ingredient.id)}
          >
            <IngredientQuantityRow
              amountRef={(input) => keepRef(amountRefMap.current, ingredient.id, input)}
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
      <RecipePhotoField file={photoFile} onChange={changePhoto} title={cleanName(title)} />
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

// Space kept above a field brought into view, so its label shows too.
const SCROLL_MARGIN = 48;

// A field Save found wrong: a text field, or a question to answer.
type InvalidField = Readonly<{ input: TextInput } | { question: Text }>;

type InvalidFieldSearch = Readonly<{
  amountRefMap: ReadonlyMap<number, TextInput>;
  choiceRefMap: ReadonlyMap<number, Text>;
  invalidIdList: readonly number[];
  selectedList: readonly Ingredient[];
  // The title's field when it's empty.
  titleInput: null | TextInput | undefined;
  undecidedIdList: readonly number[];
}>;

// A row of the form, read when saving.
type RowReading = Readonly<{ isInvalid: boolean; quantity?: Quantity }>;

type SavedQuantity = Readonly<{ draft: QuantityDraft; stored: Quantity }>;

// The photo a saved edit replaced or removed: no recipe has it any more.
function deleteReplacedPhoto(savedFile: string | undefined, currentFile: string | undefined) {
  if (savedFile !== undefined && savedFile !== currentFile) {
    deleteRecipePhoto(savedFile);
  }
}

// The first wrong field from the top: the title, then the ingredients in order (their amount, or
// the question whether a new one is an existing one).
function firstInvalidField({
  amountRefMap,
  choiceRefMap,
  invalidIdList,
  selectedList,
  titleInput,
  undecidedIdList,
}: InvalidFieldSearch): InvalidField | undefined {
  if (titleInput) {
    return { input: titleInput };
  }
  const wrong = selectedList.find(
    ({ id }) => invalidIdList.includes(id) || undecidedIdList.includes(id),
  );
  if (!wrong) {
    return undefined;
  }
  const input = invalidIdList.includes(wrong.id) ? amountRefMap.get(wrong.id) : undefined;
  if (input) {
    return { input };
  }
  const question = choiceRefMap.get(wrong.id);
  return question ? { question } : undefined;
}

// Keeps a row's element by ingredient id while it's on screen.
function keepRef<T>(refMap: Map<number, T>, id: number, element: null | T) {
  if (element) {
    refMap.set(id, element);
  } else {
    refMap.delete(id);
  }
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

// The recipe's new photo, or null to remove it; nothing when unchanged (not uploaded again).
function photoInput(currentFile: string | undefined, savedFile: string | undefined) {
  if (currentFile === savedFile) {
    return {};
  }
  return { photo: currentFile === undefined ? null : { file: currentFile } };
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

// The typed times as minutes (null: none), and the fields that aren't a number of minutes.
function readTimes(drafts: TimeDrafts) {
  const prepMinutes = parseMinutes(drafts.prep);
  const cookMinutes = parseMinutes(drafts.cook);
  const invalidList: (keyof TimeDrafts)[] = [];
  if (prepMinutes === undefined) {
    invalidList.push('prep');
  }
  if (cookMinutes === undefined) {
    invalidList.push('cook');
  }
  return { cookMinutes, invalidList, prepMinutes };
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

// Scrolls the page so the element sits near its top.
function scrollToTop(
  element: Text | TextInput,
  scrollView: null | ScrollView,
  content: null | View,
) {
  if (scrollView && content) {
    element.measureLayout(content, (_x, y) => {
      scrollView.scrollTo({ y: Math.max(0, y - SCROLL_MARGIN) });
    });
  }
}

// Scrolls a wrong field into view and gives it the focus: the keyboard's for a text field, the
// screen reader's for a question.
function showField(field: InvalidField, scrollView: null | ScrollView, content: null | View) {
  scrollToTop('input' in field ? field.input : field.question, scrollView, content);
  if ('input' in field) {
    field.input.focus();
  } else {
    AccessibilityInfo.sendAccessibilityEvent(field.question, 'focus');
  }
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

// Keeps a focused field near the top of the page: the field's own content (an ingredient search's
// suggestions) shows under it, above the keyboard. Scrolled again once the keyboard is open: the
// page, shorter, can then scroll further.
function useKeepAtTop(scrollViewRef: RefObject<null | ScrollView>, contentRef: RefObject<View>) {
  const fieldRef = useRef<null | TextInput>(null);
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      const field = fieldRef.current;
      if (field?.isFocused()) {
        scrollToTop(field, scrollViewRef.current, contentRef.current);
      }
    });
    return () => subscription.remove();
  }, [contentRef, scrollViewRef]);
  return (field: TextInput) => {
    fieldRef.current = field;
    scrollToTop(field, scrollViewRef.current, contentRef.current);
  };
}

function withoutId(idSet: ReadonlySet<number>, id: number): ReadonlySet<number> {
  const next = new Set(idSet);
  next.delete(id);
  return next;
}

// The quantities read from a photo, in the reader's units ("2 cups" shows as 473 ml in European
// units).
function withScannedDrafts(
  draftMap: ReadonlyMap<number, QuantityDraft>,
  quantityList: readonly (readonly [number, Quantity])[],
  t: Messages,
  units: UnitSystem,
): Map<number, QuantityDraft> {
  const next = new Map(draftMap);
  for (const [id, quantity] of quantityList) {
    next.set(id, toSaved(toStored(quantity), t, units).draft);
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
