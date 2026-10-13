import { useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { cleanName, toNameKey } from '@/lib/text';
import type { Ingredient } from '../db/ingredient-queries';
import { useIngredientSuggestions } from '../hooks/use-ingredients';

// Enough to pick from at a glance without rendering hundreds of chips.
export const MAX_SUGGESTIONS = 12;

type IngredientPickerProps = Readonly<{
  emptyMessage: string;
  // Only suggest ingredients some recipe uses.
  isUsedOnly?: boolean;
  label: string;
  onChange: (selectedList: Ingredient[]) => void;
  // When given, a typed name that matches no ingredient can be created.
  onCreate?: (name: string) => Ingredient;
  selectedList: readonly Ingredient[];
}>;

export function IngredientPicker({
  emptyMessage,
  isUsedOnly = false,
  label,
  onChange,
  onCreate,
  selectedList,
}: IngredientPickerProps) {
  const [search, setSearch] = useState('');
  const selectedIds = new Set(selectedList.map((ingredient) => ingredient.id));
  // Exact name first, then the most used: the likeliest picks before typing.
  const suggestionList = useIngredientSuggestions({
    excludeIdList: [...selectedIds],
    isUsedOnly,
    limit: MAX_SUGGESTIONS,
    search,
  });
  const typedName = cleanName(search);
  const isSameName = (ingredient: Ingredient) =>
    toNameKey(ingredient.name) === toNameKey(typedName);
  const canCreate =
    onCreate !== undefined &&
    typedName !== '' &&
    suggestionList.every((ingredient) => !isSameName(ingredient)) &&
    selectedList.every((ingredient) => !isSameName(ingredient));

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
