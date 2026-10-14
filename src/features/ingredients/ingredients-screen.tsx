import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { headerActions } from '@/components/header-actions';
import { getPagingProps } from '@/components/paging-props';
import { TextField } from '@/components/text-field';
import { useConfirmDelete } from '@/components/use-confirm-delete';
import { useDatabase } from '@/db/database-context';
import { useMessages } from '@/i18n/i18n-provider';
import { cleanName } from '@/lib/text';
import type { IngredientListItem } from './db/ingredient-queries';
import { IngredientRow } from './components/ingredient-row';
import { deleteIngredient, findOrCreateIngredient } from './db/ingredient-queries';
import { useIngredientPages } from './hooks/use-ingredients';

// The ingredient catalog: one field both filters the list and adds a new ingredient.
export function IngredientsScreen() {
  const database = useDatabase();
  const t = useMessages();
  const confirmDelete = useConfirmDelete();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string>();
  // Filtered in SQL, PAGE_SIZE rows at a time.
  const ingredientPages = useIngredientPages(search);

  const addIngredient = () => {
    const name = cleanName(search);
    if (!name) {
      setError(t.ingredients.typeName);
      return;
    }
    const ingredient = findOrCreateIngredient(database, name);
    if (ingredient.isNew) {
      setSearch('');
    } else {
      setError(t.ingredients.alreadyExists(ingredient.name));
    }
  };

  const askToDelete = (ingredient: IngredientListItem) => {
    confirmDelete({
      name: ingredient.name,
      onConfirm: () => {
        // The list hides Delete for used ingredients, but it may be stale by a tick.
        if (deleteIngredient(database, ingredient.id) === 'in-use') {
          Alert.alert(t.ingredients.inUseTitle(ingredient.name), t.ingredients.inUseMessage, [
            { text: t.common.ok },
          ]);
        }
      },
    });
  };

  return (
    <>
      <Drawer.Screen
        options={{
          // Adds what's typed in the search field (Enter does the same).
          headerRight: headerActions(
            <Button
              accessibilityHint={t.ingredients.addHint}
              accessibilityLabel={t.ingredients.addLabel}
              icon="plus"
              isIconOnly
              label={t.ingredients.add}
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
            <Text style={styles.noMatch}>{t.ingredients.noMatch(search)}</Text>
          ) : (
            <EmptyState message={t.ingredients.emptyMessage} title={t.ingredients.emptyTitle} />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <TextField
              error={error}
              label={t.ingredients.searchOrAdd}
              onChangeText={(text) => {
                setSearch(text);
                setError(undefined);
              }}
              onSubmitEditing={addIngredient}
              placeholder={t.ingredients.placeholder}
              returnKeyType="done"
              submitBehavior="submit"
              value={search}
            />
          </View>
        }
        renderItem={({ item }) => <IngredientRow ingredient={item} onDelete={askToDelete} />}
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
