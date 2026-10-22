import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { RecipeKind } from '@/db/schema';
import type { Messages } from '@/i18n/en';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { getPagingProps } from '@/components/paging-props';
import { screenScrollProps } from '@/components/screen-scroll-props';
import { TextField } from '@/components/text-field';
import { useFocusRing } from '@/components/use-focus-ring';
import { SyncStatusButton } from '@/features/sync/components/sync-status-button';
import { useSyncState } from '@/features/sync/sync-store';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import type { RecipeFilterValues } from './components/recipe-filters';
import type { RecipeListItem } from './db/recipe-queries';
import type { KindTexts } from './kind';
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
import { kindTexts } from './kind';
import { formatMonths } from './months';
import { describeSeason } from './season';

type RecipeRowProps = Readonly<{ kind: RecipeKind; recipe: RecipeListItem }>;

// Dishes (Recipes, in the menu) or drinks (Drinks).
type RecipesScreenProps = Readonly<{ kind?: RecipeKind }>;

export function RecipesScreen({ kind = 'dish' }: RecipesScreenProps) {
  const t = useMessages();
  const texts = kindTexts(t, kind);
  const [search, setSearch] = useState('');
  const [chosenFilterValues, setFilterValues] = useState<RecipeFilterValues>(NO_FILTERS);
  // Only the title search shows at first; hidden filters stay applied.
  const [isFiltersShown, setIsFiltersShown] = useState(false);
  // Mine or anyone's only with a sync server: without one, every recipe is the phone's.
  const { connection } = useSyncState();
  const isAuthorShown = connection !== undefined;
  const filterValues: RecipeFilterValues = isAuthorShown
    ? chosenFilterValues
    : { ...chosenFilterValues, author: 'any' };
  const queryFilters = toQueryFilters(filterValues, search, kind, connection);
  // Filtered in SQL, PAGE_SIZE rows at a time; counts in SQL too.
  const recipePages = useRecipePages(queryFilters);
  const matchCount = useRecipeCount(queryFilters);
  const recipeCount = useRecipeCount({ ingredientIdList: [], kind });
  const isFiltering = search.trim() !== '' || hasFilters(filterValues);
  const matchText = describeMatches(matchCount, search, filterValues, texts);

  return (
    <>
      <Drawer.Screen
        options={{
          headerRight: HEADER_ACTIONS[kind],
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
              message={isTv ? texts.emptyMessageOnTv : texts.emptyMessage}
              title={texts.emptyTitle}
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
                    label={texts.search}
                    onChangeText={setSearch}
                    placeholder={t.recipes.searchPlaceholder}
                    returnKeyType="search"
                    value={search}
                  />
                </View>
                <Button
                  accessibilityHint={
                    isFiltersShown ? t.filters.hideHint : texts.showFiltersHint(isAuthorShown)
                  }
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
              {isFiltersShown && (
                <RecipeFilters
                  isAuthorShown={isAuthorShown}
                  kind={kind}
                  onChange={setFilterValues}
                  values={filterValues}
                />
              )}
              {isFiltering && (
                <Text accessibilityLiveRegion="polite" style={styles.matchCount}>
                  {matchText}
                </Text>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => <RecipeRow kind={kind} recipe={item} />}
        style={styles.list}
        {...getPagingProps(recipePages)}
        {...screenScrollProps}
      />
    </>
  );
}

// How many match: "3 recipes match."; with a title search only: "No recipe matches “pizza”.".
function describeMatches(
  matchCount: number,
  search: string,
  filterValues: RecipeFilterValues,
  texts: KindTexts,
): string {
  return matchCount === 0 && !hasFilters(filterValues)
    ? texts.noMatch(search)
    : texts.matchCount(matchCount);
}

// "Maturation 2 months" for a drink that gives it.
function describeMaturation(item: RecipeListItem, t: Messages): string | undefined {
  return item.maturationMonths === undefined
    ? undefined
    : t.recipes.times({ maturation: formatMonths(t, item.maturationMonths) });
}

// What a screen reader announces for a row: its labels, read as one (a drink has no course).
function describeRecipeRow(item: RecipeListItem, kind: RecipeKind, t: Messages): string {
  const ingredients = t.recipes.ingredientCount(item.ingredientCount);
  return kind === 'drink'
    ? t.recipes.rowLabel(item.title, [describeMaturation(item, t), ingredients])
    : t.recipes.rowLabel(item.title, [
        describeSeason(item.season, t),
        t.courses[item.course],
        ingredients,
      ]);
}

// Read-only on a TV: recipes are written on the phone.
const recipesHeaderActions = headerActions(
  <>
    <SyncStatusButton />
    {!isTv && <NewRecipeButton kind="dish" />}
  </>,
);
const drinksHeaderActions = headerActions(
  <>
    <SyncStatusButton />
    {!isTv && <NewRecipeButton kind="drink" />}
  </>,
);
const HEADER_ACTIONS = { dish: recipesHeaderActions, drink: drinksHeaderActions } as const;

// Opens the form of a new recipe (a dish or a drink).
function NewRecipeButton({ kind }: Readonly<{ kind: RecipeKind }>) {
  const t = useMessages();
  const { isReading, start } = useNewRecipe(kind);

  return (
    <>
      <Button
        accessibilityHint={t.recipes.newHint}
        accessibilityLabel={kindTexts(t, kind).newRecipe}
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
function RecipeRow({ kind, recipe }: RecipeRowProps) {
  const t = useMessages();
  const { focusProps, focusStyle } = useFocusRing();
  const maturation = describeMaturation(recipe, t);

  return (
    <Pressable
      accessibilityHint={kindTexts(t, kind).openHint}
      accessibilityLabel={describeRecipeRow(recipe, kind, t)}
      accessibilityRole="button"
      onPress={() => router.push({ params: { id: String(recipe.id) }, pathname: '/recipe/[id]' })}
      {...focusProps}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, focusStyle]}
    >
      <Text style={styles.title}>{recipe.title}</Text>
      <View style={styles.details}>
        {/* A drink has no season nor course: its maturation time, if it has one. */}
        {kind === 'dish' ? (
          <View style={styles.labels}>
            <SeasonLabel season={recipe.season} />
            <CourseLabel course={recipe.course} />
          </View>
        ) : (
          maturation !== undefined && <Text style={styles.detail}>{maturation}</Text>
        )}
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
