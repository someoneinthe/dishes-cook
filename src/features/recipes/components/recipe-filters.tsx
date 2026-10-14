import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { Messages } from '@/i18n/en';
import { SegmentedControl } from '@/components/segmented-control';
import { IngredientPicker } from '@/features/ingredients/components/ingredient-picker';
import { useMessages } from '@/i18n/i18n-provider';
import type { RecipeFilters as RecipeQueryFilters } from '../db/recipe-queries';
import { courseOptionList } from '../course';
import { SEASON_ICONS } from '../season';

export type CourseFilter = 'any' | NonNullable<RecipeQueryFilters['course']>;
// What the filters show: the picked ingredients keep their names for the chips.
export type RecipeFilterValues = Readonly<{
  course: CourseFilter;
  ingredientList: readonly Ingredient[];
  season: SeasonFilter;
}>;

export type SeasonFilter = 'any' | NonNullable<RecipeQueryFilters['season']>;

export const NO_FILTERS: RecipeFilterValues = { course: 'any', ingredientList: [], season: 'any' };

type RecipeFiltersProps = Readonly<{
  // Season and course only (the meal choice).
  isIngredientPickerHidden?: boolean;
  onChange: (values: RecipeFilterValues) => void;
  values: RecipeFilterValues;
}>;

export function hasFilters(values: RecipeFilterValues): boolean {
  return values.season !== 'any' || values.course !== 'any' || values.ingredientList.length > 0;
}

// Season, course and ingredients the recipes must have. The list is narrowed in SQL
// (toQueryFilters).
export function RecipeFilters({
  isIngredientPickerHidden = false,
  onChange,
  values,
}: RecipeFiltersProps) {
  const t = useMessages();

  return (
    <View style={styles.container}>
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

// The filters as the recipe queries take them.
export function toQueryFilters(values: RecipeFilterValues, search: string): RecipeQueryFilters {
  return {
    course: values.course === 'any' ? undefined : values.course,
    ingredientIdList: values.ingredientList.map((ingredient) => ingredient.id),
    search,
    season: values.season === 'any' ? undefined : values.season,
  };
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
