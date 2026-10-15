import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { screenScrollProps } from '@/components/screen-scroll-props';
import { useConfirmDelete } from '@/components/use-confirm-delete';
import { useDatabase } from '@/db/database-context';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import { RecipeDetails } from './components/recipe-details';
import { deleteRecipe } from './db/recipe-queries';
import { useRecipe } from './hooks/use-recipes';

export function RecipeDetailScreen() {
  const database = useDatabase();
  const t = useMessages();
  const confirmDelete = useConfirmDelete();
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
        <Stack.Screen options={{ title: t.recipes.recipe }} />
        <EmptyState message={t.recipes.notFoundMessage} title={t.recipes.notFoundTitle} />
      </View>
    );
  }

  const askToDelete = () => {
    confirmDelete({
      message: t.recipes.deleteMessage,
      name: recipe.title,
      onConfirm: () => {
        setIsDeleted(true);
        deleteRecipe(database, recipe.id);
        router.back();
      },
    });
  };

  const headerButtons = (
    <>
      <Button
        icon="pencil"
        isIconOnly
        label={t.common.edit}
        onPress={() =>
          router.push({ params: { id: String(recipe.id) }, pathname: '/recipe/[id]/edit' })
        }
        variant="secondary"
      />
      <Button
        icon="trash-can-outline"
        isIconOnly
        label={t.common.delete}
        onPress={askToDelete}
        variant="danger"
      />
    </>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen} {...screenScrollProps}>
      <Stack.Screen
        options={{
          // Read-only on a TV: recipes are edited on the phone.
          headerRight: isTv ? undefined : headerActions(headerButtons),
          title: recipe.title,
        }}
      />
      <RecipeDetails recipe={recipe} />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    // Centered on wide screens (TV).
    alignSelf: 'center',
    gap: theme.gap(6),
    maxWidth: theme.size.maxContent,
    padding: theme.gap(4),
    width: '100%',
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
}));
