import type { RefObject } from 'react';
import type {
  ScrollViewInstance,
  TextInputInstance,
  TextInstance,
  ViewInstance,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Course, RecipeKind, Season } from '@/db/schema';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { PhoneOnly } from '@/components/phone-only';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { useDatabase } from '@/db/database-context';
import { IngredientPicker } from '@/features/ingredients/components/ingredient-picker';
import { usePreferences } from '@/features/settings/preferences';
import { useMessages } from '@/i18n/i18n-provider';
import { cleanName } from '@/lib/text';
import type { TimeDrafts } from './components/recipe-time-fields';
import type { Recipe } from './db/recipe-queries';
import type { ScannedRecipe } from './scanned-recipe';
import { IngredientQuantityRow } from './components/ingredient-quantity-row';
import { InstructionsField } from './components/instructions-field';
import { RecipePhotoField } from './components/recipe-photo-field';
import { RecipeTimeFields } from './components/recipe-time-fields';
import { SelectedIngredient } from './components/selected-ingredient';
import { courseOptionList } from './course';
import { getRecipe, isRecipeSaved, saveRecipe } from './db/recipe-queries';
import { useKeepAtTop } from './hooks/use-keep-at-top';
import { useNewIngredients } from './hooks/use-new-ingredients';
import { kindTexts, useKindHeaderOptions } from './kind';
import { formatTypedMonths } from './months';
import {
  firstInvalidField,
  firstWrongTime,
  keepRef,
  readTimes,
  showField,
} from './recipe-form-fields';
import {
  EMPTY_DRAFT,
  moveDraft,
  readQuantities,
  savedQuantities,
  swapIngredient,
  withoutId,
  withScannedDrafts,
} from './recipe-form-quantities';
import { deleteRecipePhoto } from './recipe-photos';
import { forgetScannedDraft, getScannedDraft } from './scanned-recipe';
import { seasonOptionList } from './season';

type RecipeFormProps = Readonly<{
  // Undefined for a new recipe.
  initialRecipe: Recipe | undefined;
  // A dish or a drink (no course for a drink).
  kind: RecipeKind;
  // A new recipe started from a photo (useNewRecipe): the form starts filled in with it.
  scannedRecipe: ScannedRecipe | undefined;
  screenTitle: string;
}>;

// Read-only on a TV: a link to the form (/recipe/new, /recipe/[id]/edit) leads to the meal choice.
export function RecipeFormScreen() {
  return (
    <PhoneOnly>
      <RecipeFormRoute />
    </PhoneOnly>
  );
}

// The photo a saved edit replaced or removed: no recipe has it any more.
function deleteReplacedPhoto(savedFile: string | undefined, currentFile: string | undefined) {
  if (savedFile !== undefined && savedFile !== currentFile) {
    deleteRecipePhoto(savedFile);
  }
}

// The recipe's new photo, or null to remove it; nothing when unchanged (not uploaded again).
function photoInput(currentFile: string | undefined, savedFile: string | undefined) {
  if (currentFile === savedFile) {
    return {};
  }
  return { photo: currentFile === undefined ? null : { file: currentFile } };
}

function RecipeForm({ initialRecipe, kind, scannedRecipe, screenTitle }: RecipeFormProps) {
  const database = useDatabase();
  const t = useMessages();
  const kindHeaderOptions = useKindHeaderOptions(kind);
  // New ingredients, created on Save: typed in the picker, or read from a photo (matched to the
  // existing ones).
  const newIngredients = useNewIngredients(scannedRecipe?.ingredientList);
  const [title, setTitle] = useState(() => startingText(initialRecipe, scannedRecipe, 'title'));
  const [season, setSeason] = useState<Season>(initialRecipe?.season ?? 'both');
  // A drink has no season: it's for both.
  const savedSeason: Season = kind === 'drink' ? 'both' : season;
  // Every recipe has a course: a main course unless chosen otherwise.
  const [course, setCourse] = useState<Course>(initialRecipe?.course ?? 'main');
  const [selectedIngredientList, setSelectedIngredientList] = useState<Ingredient[]>(
    () => initialRecipe?.ingredientList ?? newIngredients.initial.addedList,
  );
  const [instructions, setInstructions] = useState(() =>
    startingText(initialRecipe, scannedRecipe, 'instructions'),
  );
  const [titleError, setTitleError] = useState<string>();
  // A drink has no cooking time: none is kept or saved.
  const savedCookMinutes = kind === 'drink' ? undefined : initialRecipe?.cookMinutes;
  const [timeDrafts, setTimeDrafts] = useState<TimeDrafts>(() => ({
    cook: savedCookMinutes === undefined ? '' : String(savedCookMinutes),
    // A drink's only, as typed back ("1,5" in French).
    maturation: formatTypedMonths(t, initialRecipe?.maturationMonths),
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
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  // ScrollView's `innerViewRef` is typed as never empty, which a ref is before mounting.
  const contentRef = useRef<ViewInstance>(null) as RefObject<ViewInstance>;
  const titleRef = useRef<TextInputInstance>(null);
  const prepRef = useRef<TextInputInstance>(null);
  const cookRef = useRef<TextInputInstance>(null);
  const maturationRef = useRef<TextInputInstance>(null);
  const keepAtTop = useKeepAtTop(scrollViewRef, contentRef);
  const amountRefMap = useRef(new Map<number, TextInputInstance>());
  const choiceRefMap = useRef(new Map<number, TextInstance>());
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
      setTitleError(kindTexts(t, kind).titleRequired);
    }
    const {
      cookMinutes,
      invalidList: timeErrorList,
      maturationMonths,
      prepMinutes,
    } = readTimes(timeDrafts, kind);
    setInvalidTimeList(timeErrorList);
    const firstInvalid = firstInvalidField({
      amountRefMap: amountRefMap.current,
      choiceRefMap: choiceRefMap.current,
      invalidIdList,
      selectedList: selectedIngredientList,
      timeInput: firstWrongTime(timeErrorList, {
        cook: cookRef.current,
        maturation: maturationRef.current,
        prep: prepRef.current,
      }),
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
      kind,
      maturationMonths,
      newIngredientNames: newIngredients.nameMap,
      ...photoInput(photoFile, initialRecipe?.photoFile),
      prepMinutes,
      quantities,
      season: savedSeason,
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
      const texts = kindTexts(t, kind);
      Alert.alert(texts.deletedWhileEditingTitle, texts.deletedWhileEditingMessage, [
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
              accessibilityHint={kindTexts(t, kind).saveHint}
              accessibilityLabel={kindTexts(t, kind).saveRecipe}
              icon="check"
              isIconOnly
              label={t.common.save}
              onPress={save}
            />,
          ),
          title: screenTitle,
          ...kindHeaderOptions,
        }}
      />
      <TextField
        error={titleError}
        label={t.recipes.title}
        onChangeText={(text) => {
          setTitle(text);
          setTitleError(undefined);
        }}
        placeholder={kindTexts(t, kind).titlePlaceholder}
        ref={titleRef}
        value={title}
      />
      {/* A drink has no season nor course. */}
      {kind === 'dish' && (
        <>
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
        </>
      )}
      <RecipeTimeFields
        drafts={timeDrafts}
        inputRefs={{ cook: cookRef, maturation: maturationRef, prep: prepRef }}
        invalidList={invalidTimeList}
        kind={kind}
        onChange={(drafts) => {
          setTimeDrafts(drafts);
          setInvalidTimeList([]);
        }}
      />
      <IngredientPicker
        emptyMessage={t.recipes.ingredientsEmpty}
        label={t.recipes.ingredients}
        onChange={setSelectedIngredientList}
        // Created when the recipe is saved, if still in it.
        onCreate={newIngredients.add}
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
      <InstructionsField
        onChange={setInstructions}
        placeholder={kindTexts(t, kind).instructionsPlaceholder}
        value={instructions}
      />
    </ScrollView>
  );
}

// Creates a recipe (/recipe/new) or edits one (/recipe/[id]/edit).
function RecipeFormRoute() {
  const database = useDatabase();
  const {
    draft,
    id,
    kind: kindParameter,
  } = useLocalSearchParams<{
    draft?: string;
    id?: string;
    kind?: string;
  }>();
  const recipeId = id === undefined ? undefined : Number(id);
  // The form starts from the saved recipe; reads are synchronous, so it's ready on first render.
  const [initialRecipe] = useState(() =>
    recipeId === undefined ? undefined : getRecipe(database, recipeId),
  );
  const [scannedRecipe] = useState(() =>
    recipeId === undefined ? getScannedDraft(draft) : undefined,
  );
  // The draft goes with its form (saved or left).
  useEffect(
    () => () => {
      if (draft !== undefined) {
        forgetScannedDraft(draft);
      }
    },
    [draft],
  );
  const t = useMessages();
  // An edit keeps the recipe's kind; a new recipe takes the one it was started for (useNewRecipe).
  const kind: RecipeKind = initialRecipe?.kind ?? (kindParameter === 'drink' ? 'drink' : 'dish');
  const texts = kindTexts(t, kind);
  const screenTitle = recipeId === undefined ? texts.newRecipe : texts.editRecipe;
  const kindHeaderOptions = useKindHeaderOptions(kind);

  if (recipeId !== undefined && !initialRecipe) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: screenTitle, ...kindHeaderOptions }} />
        <EmptyState message={t.recipes.notFoundMessage} title={texts.notFoundTitle} />
      </View>
    );
  }
  return (
    <RecipeForm
      initialRecipe={initialRecipe}
      kind={kind}
      scannedRecipe={scannedRecipe}
      screenTitle={screenTitle}
    />
  );
}

// The title or the instructions the form starts with: the saved recipe's, or the photo's.
function startingText(
  recipe: Recipe | undefined,
  scanned: ScannedRecipe | undefined,
  field: 'instructions' | 'title',
): string {
  return recipe?.[field] ?? scanned?.[field] ?? '';
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
