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
import { TextField } from '@/components/text-field';
import { useMessages } from '@/i18n/i18n-provider';
import type { RecipeFilterValues } from './components/recipe-filters';
import type { RecipeListItem } from './db/recipe-queries';
import {
  countFilters,
  hasFilters,
  NO_FILTERS,
  RecipeFilters,
  toQueryFilters,
} from './components/recipe-filters';
import { CourseLabel, SeasonLabel } from './components/recipe-labels';
import { useRecipeCount, useRecipePages } from './hooks/use-recipes';
import { describeSeason } from './season';

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
  const addRecipe = () => router.push('/recipe/new');

  return (
    <>
      <Drawer.Screen
        options={{
          headerRight: headerActions(
            <Button
              accessibilityHint={t.recipes.newHint}
              accessibilityLabel={t.recipes.newRecipe}
              icon="plus"
              isIconOnly
              label={t.recipes.new}
              onPress={addRecipe}
            />,
          ),
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
            <EmptyState message={t.recipes.emptyMessage} title={t.recipes.emptyTitle} />
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
                  icon={isFiltersShown ? 'filter-variant-remove' : 'filter-variant'}
                  isExpanded={isFiltersShown}
                  label={t.filters.toggle(countFilters(filterValues))}
                  onPress={() => setIsFiltersShown(!isFiltersShown)}
                  variant="secondary"
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
        renderItem={({ item }) => (
          <Pressable
            accessibilityHint={t.recipes.openHint}
            accessibilityLabel={describeRecipeRow(item, t)}
            accessibilityRole="button"
            onPress={() =>
              router.push({ params: { id: String(item.id) }, pathname: '/recipe/[id]' })
            }
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.title}>{item.title}</Text>
            <View style={styles.details}>
              <View style={styles.labels}>
                <SeasonLabel season={item.season} />
                <CourseLabel course={item.course} />
              </View>
              <Text style={styles.detail}>{t.recipes.ingredientCount(item.ingredientCount)}</Text>
            </View>
          </Pressable>
        )}
        style={styles.list}
        {...getPagingProps(recipePages)}
      />
    </>
  );
}

// What a screen reader announces for a row: its labels, read as one.
function describeRecipeRow(item: RecipeListItem, t: Messages): string {
  return t.recipes.rowLabel(item.title, describeSeason(item.season, t), t.courses[item.course]);
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.gap(2),
    padding: theme.gap(4),
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
