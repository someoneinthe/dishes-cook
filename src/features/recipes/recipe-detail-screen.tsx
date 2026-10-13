import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { useDatabase } from '@/db/database-context';
import { RecipeDetails } from './components/recipe-details';
import { deleteRecipe } from './db/recipe-queries';
import { useRecipe } from './hooks/use-recipes';

export function RecipeDetailScreen() {
  const database = useDatabase();
  const { id } = useLocalSearchParams<{ id: string }>();
  const liveRecipe = useRecipe(Number(id));
  // Once deleted, the screen keeps showing the recipe while it animates away (instead of
  // flashing "Recipe not found").
  const [lastRecipe, setLastRecipe] = useState(liveRecipe);
  if (liveRecipe && liveRecipe !== lastRecipe) {
    setLastRecipe(liveRecipe);
  }
  const [isDeleted, setIsDeleted] = useState(false);
  const recipe = isDeleted ? lastRecipe : liveRecipe;

  if (!recipe) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Recipe' }} />
        <EmptyState message="It may have been deleted." title="Recipe not found" />
      </View>
    );
  }

  const confirmDelete = () => {
    Alert.alert(`Delete “${recipe.title}”?`, 'Its ingredients stay in your list.', [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => {
          setIsDeleted(true);
          deleteRecipe(database, recipe.id);
          router.back();
        },
        style: 'destructive',
        text: 'Delete',
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Stack.Screen options={{ title: recipe.title }} />
      <RecipeDetails recipe={recipe} />
      <View style={styles.actions}>
        <Button
          label="Edit"
          onPress={() =>
            router.push({ params: { id: String(recipe.id) }, pathname: '/recipe/[id]/edit' })
          }
          variant="secondary"
        />
        <Button label="Delete" onPress={confirmDelete} variant="danger" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  actions: {
    flexDirection: 'row',
    gap: theme.gap(2),
    justifyContent: 'flex-end',
  },
  content: {
    gap: theme.gap(6),
    padding: theme.gap(4),
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
}));
