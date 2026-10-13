import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { getPagingProps } from '@/components/paging-props';
import { useRecipePages } from './hooks/use-recipes';
import { describeSeason } from './season';

export function RecipesScreen() {
  const recipePages = useRecipePages();
  const addRecipe = () => router.push('/recipe/new');

  return (
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
      ListHeaderComponent={<Button icon="plus" label="New recipe" onPress={addRecipe} />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityHint="Opens the recipe"
          accessibilityLabel={item.title}
          accessibilityRole="button"
          onPress={() => router.push({ params: { id: String(item.id) }, pathname: '/recipe/[id]' })}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.details}>
            <Text style={styles.detail}>{describeSeason(item.season)}</Text>
            <Text style={styles.detail}>{describeIngredientCount(item.ingredientCount)}</Text>
          </View>
        </Pressable>
      )}
      style={styles.list}
      {...getPagingProps(recipePages)}
    />
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
    flexDirection: 'row',
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
