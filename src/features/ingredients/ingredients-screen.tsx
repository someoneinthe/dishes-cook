import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { getPagingProps } from '@/components/paging-props';
import { TextField } from '@/components/text-field';
import { useDatabase } from '@/db/database-context';
import { cleanName } from '@/lib/text';
import type { IngredientListItem } from './db/ingredient-queries';
import { IngredientRow } from './components/ingredient-row';
import { deleteIngredient, findOrCreateIngredient } from './db/ingredient-queries';
import { useIngredientPages } from './hooks/use-ingredients';

// The ingredient catalog: one field both filters the list and adds a new ingredient.
export function IngredientsScreen() {
  const database = useDatabase();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string>();
  // Filtered in SQL, PAGE_SIZE rows at a time.
  const ingredientPages = useIngredientPages(search);

  const addIngredient = () => {
    const name = cleanName(search);
    if (!name) {
      setError('Type the name of the ingredient to add.');
      return;
    }
    const ingredient = findOrCreateIngredient(database, name);
    if (ingredient.isNew) {
      setSearch('');
    } else {
      setError(`“${ingredient.name}” already exists.`);
    }
  };

  const confirmDelete = (ingredient: IngredientListItem) => {
    Alert.alert(`Delete “${ingredient.name}”?`, undefined, [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => {
          // The list hides Delete for used ingredients, but it may be stale by a tick.
          if (deleteIngredient(database, ingredient.id) === 'in-use') {
            Alert.alert(
              `“${ingredient.name}” is used by a recipe`,
              'Remove it from its recipes first.',
            );
          }
        },
        style: 'destructive',
        text: 'Delete',
      },
    ]);
  };

  return (
    <>
      <Drawer.Screen
        options={{
          // Adds what's typed in the search field (Enter does the same).
          headerRight: headerActions(
            <Button
              accessibilityHint="Adds the name typed in the search field"
              accessibilityLabel="Add ingredient"
              icon="plus"
              isIconOnly
              label="Add"
              onPress={addIngredient}
            />,
          ),
        }}
      />
      <FlatList
        contentContainerStyle={styles.content}
        data={ingredientPages.itemList}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(ingredient) => String(ingredient.id)}
        ListEmptyComponent={
          search ? (
            <Text style={styles.noMatch}>{`No ingredient matches “${search}”.`}</Text>
          ) : (
            <EmptyState
              message="Add the ingredients you cook with, here or while writing a recipe."
              title="No ingredients yet"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <TextField
              error={error}
              label="Search or add an ingredient"
              onChangeText={(text) => {
                setSearch(text);
                setError(undefined);
              }}
              onSubmitEditing={addIngredient}
              placeholder="e.g. Carrot"
              returnKeyType="done"
              submitBehavior="submit"
              value={search}
            />
          </View>
        }
        renderItem={({ item }) => <IngredientRow ingredient={item} onDelete={confirmDelete} />}
        style={styles.list}
        {...getPagingProps(ingredientPages)}
      />
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.gap(2),
    padding: theme.gap(4),
  },
  header: {
    gap: theme.gap(2),
    marginBottom: theme.gap(2),
  },
  list: {
    backgroundColor: theme.colors.background,
  },
  noMatch: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
}));
