import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import type { RecipeKind } from '@/db/schema';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { Messages } from '@/i18n/en';
import { SegmentedControl } from '@/components/segmented-control';
import { IngredientPicker } from '@/features/ingredients/components/ingredient-picker';
import { useMessages } from '@/i18n/i18n-provider';
import type { RecipeFilters as RecipeQueryFilters } from '../db/recipe-queries';
import { courseOptionList } from '../course';
import { SEASON_ICONS } from '../season';

// Anyone's recipes, or only mine (with a sync server, see RecipeQueryFilters['mine']).
export type AuthorFilter = 'any' | 'mine';
export type CourseFilter = 'any' | NonNullable<RecipeQueryFilters['course']>;
// What the filters show: the picked ingredients keep their names for the chips.
export type RecipeFilterValues = Readonly<{
  author: AuthorFilter;
  course: CourseFilter;
  ingredientList: readonly Ingredient[];
  season: SeasonFilter;
}>;

export type SeasonFilter = 'any' | NonNullable<RecipeQueryFilters['season']>;

export const NO_FILTERS: RecipeFilterValues = {
  author: 'any',
  course: 'any',
  ingredientList: [],
  season: 'any',
};

type RecipeFiltersProps = Readonly<{
  // Anyone's or mine: only with a sync server (without one, every recipe is the phone's).
  isAuthorShown?: boolean;
  // Season and course only (the meal choice).
  isIngredientPickerHidden?: boolean;
  // A drink's: ingredients only (drinks have no season nor course).
  kind?: RecipeKind;
  onChange: (values: RecipeFilterValues) => void;
  values: RecipeFilterValues;
}>;

// How many filters are on (each selected ingredient counts).
export function countFilters(values: RecipeFilterValues): number {
  return (
    (values.author === 'any' ? 0 : 1) +
    (values.season === 'any' ? 0 : 1) +
    (values.course === 'any' ? 0 : 1) +
    values.ingredientList.length
  );
}

export function hasFilters(values: RecipeFilterValues): boolean {
  return countFilters(values) > 0;
}

// Author, season, course and ingredients the recipes must have. The list is narrowed in SQL
// (toQueryFilters).
export function RecipeFilters({
  isAuthorShown = false,
  isIngredientPickerHidden = false,
  kind = 'dish',
  onChange,
  values,
}: RecipeFiltersProps) {
  const t = useMessages();

  return (
    <View style={styles.container}>
      {isAuthorShown && (
        <SegmentedControl
          label={t.filters.addedBy}
          onChange={(author) => onChange({ ...values, author })}
          optionList={authorFilterOptionList(t)}
          value={values.author}
        />
      )}
      {kind === 'dish' && (
        <>
          <SegmentedControl
            label={t.recipes.season}
            onChange={(season) => onChange({ ...values, season })}
            optionList={seasonFilterOptionList(t)}
            value={values.season}
          />
          <SegmentedControl
            label={t.recipes.course}
            onChange={(course) => onChange({ ...values, course })}
            optionList={courseFilterOptionList(t)}
            value={values.course}
          />
        </>
      )}
      {!isIngredientPickerHidden && (
        <IngredientPicker
          emptyMessage={t.filters.noUsedIngredient}
          isUsedOnly
          label={t.filters.withIngredients}
          onChange={(ingredientList) => onChange({ ...values, ingredientList })}
          selectedList={values.ingredientList}
        />
      )}
    </View>
  );
}

// The filters as the recipe queries take them, for the dishes or the drinks (no season nor course).
// `account`: the sync server's account the phone is signed in to (its id unknown until the first
// sync); mine only with one.
export function toQueryFilters(
  values: RecipeFilterValues,
  search: string,
  kind: RecipeKind,
  account?: Readonly<{ accountId?: string }>,
): RecipeQueryFilters {
  return {
    course: kind === 'drink' || values.course === 'any' ? undefined : values.course,
    ingredientIdList: values.ingredientList.map((ingredient) => ingredient.id),
    kind,
    mine: account && values.author === 'mine' ? { accountId: account.accountId } : undefined,
    search,
    season: kind === 'drink' || values.season === 'any' ? undefined : values.season,
  };
}

function authorFilterOptionList(t: Messages): readonly SegmentedOption<AuthorFilter>[] {
  return [
    { label: t.filters.anyone, value: 'any' },
    { label: t.filters.me, value: 'mine' },
  ];
}

function courseFilterOptionList(t: Messages): readonly SegmentedOption<CourseFilter>[] {
  return [{ label: t.filters.any, value: 'any' }, ...courseOptionList(t)];
}

function seasonFilterOptionList(t: Messages): readonly SegmentedOption<SeasonFilter>[] {
  return [
    { label: t.filters.any, value: 'any' },
    { ...SEASON_ICONS.winter, label: t.seasons.winter, value: 'winter' },
    { ...SEASON_ICONS.summer, label: t.seasons.summer, value: 'summer' },
  ];
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.gap(5),
  },
}));
