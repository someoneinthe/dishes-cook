import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { FlatList, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { getPagingProps } from '@/components/paging-props';
import { SeasonLabel } from './components/season-label';
import { useRecipePages } from './hooks/use-recipes';

export function RecipesScreen() {
  const recipePages = useRecipePages();
  const addRecipe = () => router.push('/recipe/new');

  return (
    <>
      <Drawer.Screen
        options={{
          headerRight: headerActions(
            <Button
              accessibilityHint="Opens an empty recipe form"
              accessibilityLabel="New recipe"
              icon="plus"
              isIconOnly
              label="New"
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
          <EmptyState
            message="Save the dishes you like to cook, then let the meal choice pick one for you."
            title="No recipes yet"
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityHint="Opens the recipe"
            accessibilityLabel={item.title}
            accessibilityRole="button"
            onPress={() =>
              router.push({ params: { id: String(item.id) }, pathname: '/recipe/[id]' })
            }
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.title}>{item.title}</Text>
            <View style={styles.details}>
              <SeasonLabel season={item.season} />
              <Text style={styles.detail}>{describeIngredientCount(item.ingredientCount)}</Text>
            </View>
          </Pressable>
        )}
        style={styles.list}
        {...getPagingProps(recipePages)}
      />
    </>
  );
}

function describeIngredientCount(count: number): string {
  return count === 1 ? '1 ingredient' : `${count} ingredients`;
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
    flexDirection: 'row',
    gap: theme.gap(2),
    justifyContent: 'space-between',
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
