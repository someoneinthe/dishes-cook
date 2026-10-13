import { useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { cleanName, isMatchingSearch, toNameKey } from '@/lib/text';
import type { Ingredient } from '../db/ingredient-queries';

// Enough to pick from at a glance without rendering hundreds of chips.
export const MAX_SUGGESTIONS = 12;

type IngredientPickerProps = Readonly<{
  // Candidates, in suggestion order (e.g. the most used first).
  availableList: readonly Ingredient[];
  emptyMessage: string;
  label: string;
  onChange: (selectedList: Ingredient[]) => void;
  // When given, a typed name that matches no ingredient can be created.
  onCreate?: (name: string) => Ingredient;
  selectedList: readonly Ingredient[];
}>;

export function IngredientPicker({
  availableList,
  emptyMessage,
  label,
  onChange,
  onCreate,
  selectedList,
}: IngredientPickerProps) {
  const [search, setSearch] = useState('');
  const selectedIds = new Set(selectedList.map((ingredient) => ingredient.id));
  const suggestionList = availableList
    .filter(
      (ingredient) => !selectedIds.has(ingredient.id) && isMatchingSearch(ingredient.name, search),
    )
    .slice(0, MAX_SUGGESTIONS);
  const typedName = cleanName(search);
  const canCreate =
    onCreate !== undefined &&
    typedName !== '' &&
    availableList.every((ingredient) => toNameKey(ingredient.name) !== toNameKey(typedName));

  const select = (ingredient: Ingredient) => {
    if (!selectedIds.has(ingredient.id)) {
      onChange([...selectedList, ingredient]);
    }
    setSearch('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {selectedList.length > 0 && (
        <View style={styles.chipList}>
          {selectedList.map((ingredient) => (
            <Chip
              accessibilityHint="Removes it from the selection"
              accessibilityLabel={`Remove ${ingredient.name}`}
              isSelected
              key={ingredient.id}
              label={`${ingredient.name}  ✕`}
              onPress={() => onChange(selectedList.filter((item) => item.id !== ingredient.id))}
            />
          ))}
        </View>
      )}
      <TextField
        autoCapitalize="none"
        isLabelHidden
        label={`Search ${label.toLowerCase()}`}
        onChangeText={setSearch}
        onSubmitEditing={() => {
          if (suggestionList[0]) {
            select(suggestionList[0]);
          } else if (canCreate) {
            select(onCreate(typedName));
          }
        }}
        placeholder={onCreate ? 'Search or add an ingredient' : 'Search an ingredient'}
        returnKeyType="done"
        submitBehavior="submit"
        value={search}
      />
      <View style={styles.chipList}>
        {suggestionList.map((ingredient) => (
          <Chip
            accessibilityHint="Adds it to the selection"
            accessibilityLabel={`Add ${ingredient.name}`}
            key={ingredient.id}
            label={ingredient.name}
            onPress={() => select(ingredient)}
          />
        ))}
        {canCreate && (
          <Chip
            accessibilityHint="Creates the ingredient and adds it to the selection"
            accessibilityLabel={`Create ${typedName}`}
            label={`+ New: ${typedName}`}
            onPress={() => select(onCreate(typedName))}
          />
        )}
      </View>
      {suggestionList.length === 0 && !canCreate && (
        <Text style={styles.hint}>{search ? 'No matching ingredient.' : emptyMessage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  container: {
    gap: theme.gap(2),
  },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
}));
