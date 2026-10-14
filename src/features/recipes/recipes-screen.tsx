import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { FlatList, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Messages } from '@/i18n/en';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { getPagingProps } from '@/components/paging-props';
import { useMessages } from '@/i18n/i18n-provider';
import type { RecipeListItem } from './db/recipe-queries';
import { CourseLabel, SeasonLabel } from './components/recipe-labels';
import { useRecipePages } from './hooks/use-recipes';
import { describeSeason } from './season';

export function RecipesScreen() {
  const t = useMessages();
  const recipePages = useRecipePages();
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
        keyExtractor={(recipe) => String(recipe.id)}
        ListEmptyComponent={
          <EmptyState message={t.recipes.emptyMessage} title={t.recipes.emptyTitle} />
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
                {item.course && <CourseLabel course={item.course} />}
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
  return t.recipes.rowLabel(
    item.title,
    describeSeason(item.season, t),
    item.course ? t.courses[item.course] : undefined,
  );
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
  title: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
}));
