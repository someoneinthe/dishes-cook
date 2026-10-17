import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Messages } from '@/i18n/en';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { getPagingProps } from '@/components/paging-props';
import { screenScrollProps } from '@/components/screen-scroll-props';
import { TextField } from '@/components/text-field';
import { useFocusRing } from '@/components/use-focus-ring';
import { SyncStatusButton } from '@/features/sync/components/sync-status-button';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import type { RecipeFilterValues } from './components/recipe-filters';
import type { RecipeListItem } from './db/recipe-queries';
import { ReadingPhoto } from './components/reading-photo';
import {
  countFilters,
  hasFilters,
  NO_FILTERS,
  RecipeFilters,
  toQueryFilters,
} from './components/recipe-filters';
import { CourseLabel, SeasonLabel } from './components/recipe-labels';
import { useNewRecipe } from './hooks/use-new-recipe';
import { useRecipeCount, useRecipePages } from './hooks/use-recipes';
import { describeSeason } from './season';

type RecipeRowProps = Readonly<{ recipe: RecipeListItem }>;

export function RecipesScreen() {
  const t = useMessages();
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<RecipeFilterValues>(NO_FILTERS);
  // Only the title search shows at first; hidden filters stay applied.
  const [isFiltersShown, setIsFiltersShown] = useState(false);
  const queryFilters = toQueryFilters(filterValues, search);
  // Filtered in SQL, PAGE_SIZE rows at a time; counts in SQL too.
  const recipePages = useRecipePages(queryFilters);
  const matchCount = useRecipeCount(queryFilters);
  const recipeCount = useRecipeCount({ ingredientIdList: [] });
  const isFiltering = search.trim() !== '' || hasFilters(filterValues);
  // Only search with a title: "no recipe matches “pizza”".
  const matchText =
    matchCount === 0 && !hasFilters(filterValues)
      ? t.recipes.noMatch(search)
      : t.recipes.matchCount(matchCount);

  return (
    <>
      <Drawer.Screen
        options={{
          headerRight: recipesHeaderActions,
        }}
      />
      <FlatList
        contentContainerStyle={styles.content}
        data={recipePages.itemList}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(recipe) => String(recipe.id)}
        ListEmptyComponent={
          // Before the first recipe; while filtering, the header tells there's no match.
          recipeCount === 0 ? (
            <EmptyState
              message={isTv ? t.recipes.emptyMessageOnTv : t.recipes.emptyMessage}
              title={t.recipes.emptyTitle}
            />
          ) : null
        }
        ListHeaderComponent={
          // No search or filters before the first recipe: there's nothing to narrow yet.
          recipeCount > 0 ? (
            <View style={styles.header}>
              <View style={styles.searchRow}>
                <View style={styles.searchField}>
                  <TextField
                    isLabelHidden
                    label={t.recipes.search}
                    onChangeText={setSearch}
                    placeholder={t.recipes.searchPlaceholder}
                    returnKeyType="search"
                    value={search}
                  />
                </View>
                <Button
                  accessibilityHint={isFiltersShown ? t.filters.hideHint : t.filters.showHint}
                  // A funnel; with a check mark while filters are on.
                  icon={hasFilters(filterValues) ? 'filter-check' : 'filter'}
                  isExpanded={isFiltersShown}
                  // Text only with Settings › Show button labels; screen readers always read it.
                  isIconOnly
                  label={t.filters.toggle(countFilters(filterValues))}
                  onPress={() => setIsFiltersShown(!isFiltersShown)}
                  // Tinted while filters are on: the list is narrowed.
                  variant={hasFilters(filterValues) ? 'active' : 'secondary'}
                />
              </View>
              {isFiltersShown && <RecipeFilters onChange={setFilterValues} values={filterValues} />}
              {isFiltering && (
                <Text accessibilityLiveRegion="polite" style={styles.matchCount}>
                  {matchText}
                </Text>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => <RecipeRow recipe={item} />}
        style={styles.list}
        {...getPagingProps(recipePages)}
        {...screenScrollProps}
      />
    </>
  );
}

// What a screen reader announces for a row: its labels, read as one.
function describeRecipeRow(item: RecipeListItem, t: Messages): string {
  return t.recipes.rowLabel(
    item.title,
    describeSeason(item.season, t),
    t.courses[item.course],
    t.recipes.ingredientCount(item.ingredientCount),
  );
}

// Read-only on a TV: recipes are written on the phone.
const recipesHeaderActions = headerActions(
  <>
    <SyncStatusButton />
    {!isTv && <NewRecipeButton />}
  </>,
);

// Opens the form of a new recipe.
function NewRecipeButton() {
  const t = useMessages();
  const { isReading, start } = useNewRecipe();

  return (
    <>
      <Button
        accessibilityHint={t.recipes.newHint}
        accessibilityLabel={t.recipes.newRecipe}
        icon="plus"
        isDisabled={isReading}
        isIconOnly
        label={t.recipes.new}
        onPress={start}
      />
      <ReadingPhoto isReading={isReading} />
    </>
  );
}

// A recipe of the list: opens it.
function RecipeRow({ recipe }: RecipeRowProps) {
  const t = useMessages();
  const { focusProps, focusStyle } = useFocusRing();

  return (
    <Pressable
      accessibilityHint={t.recipes.openHint}
      accessibilityLabel={describeRecipeRow(recipe, t)}
      accessibilityRole="button"
      onPress={() => router.push({ params: { id: String(recipe.id) }, pathname: '/recipe/[id]' })}
      {...focusProps}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, focusStyle]}
    >
      <Text style={styles.title}>{recipe.title}</Text>
      <View style={styles.details}>
        <View style={styles.labels}>
          <SeasonLabel season={recipe.season} />
          <CourseLabel course={recipe.course} />
        </View>
        <Text style={styles.detail}>{t.recipes.ingredientCount(recipe.ingredientCount)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    // Centered on wide screens (TV).
    alignSelf: 'center',
    gap: theme.gap(2),
    maxWidth: theme.size.maxContent,
    padding: theme.gap(4),
    width: '100%',
  },
  detail: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  details: {
    alignItems: 'center',
    columnGap: theme.gap(2),
    flexDirection: 'row',
    // The ingredient count goes below the labels when they don't fit side by side.
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: theme.gap(1),
  },
  header: {
    gap: theme.gap(5),
    marginBottom: theme.gap(2),
  },
  labels: {
    columnGap: theme.gap(3),
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    rowGap: theme.gap(1),
  },
  list: {
    backgroundColor: theme.colors.background,
  },
  matchCount: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  row: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    gap: theme.gap(1),
    padding: theme.gap(3),
  },
  // The field takes the room; the Filters button goes under it when the text is large.
  searchField: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: theme.size.minText,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  title: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
}));
