import type { ReactNode } from 'react';
import type { TextInputInstance } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import { cleanName, toNameKey } from '@/lib/text';
import type { Ingredient } from '../db/ingredient-queries';
import { useIngredientSuggestions } from '../hooks/use-ingredients';

// Enough to pick from at a glance without rendering hundreds of chips.
const MAX_SUGGESTIONS = 12;

// How long typing pauses before screen readers hear what the search found.
const ANNOUNCE_DELAY_MS = 1000;

type IngredientPickerProps = Readonly<{
  emptyMessage: string;
  // Only suggest ingredients some recipe uses.
  isUsedOnly?: boolean;
  label: string;
  onChange: (selectedList: Ingredient[]) => void;
  // When given, a typed name that matches no ingredient can be created.
  onCreate?: (name: string) => Ingredient;
  // The search field gets the focus (e.g. to scroll it where its suggestions show above the
  // keyboard), with the field.
  onSearchFocus?: (field: TextInputInstance) => void;
  // Shows each selected ingredient (e.g. with its quantity) instead of a chip that removes it.
  renderSelected?: (ingredient: Ingredient, remove: () => void) => ReactNode;
  selectedList: readonly Ingredient[];
}>;

type SelectedIngredientsProps = Readonly<{
  isFocusTarget: (ingredient: Ingredient) => boolean;
  onRemove: (ingredient: Ingredient) => void;
  renderSelected: IngredientPickerProps['renderSelected'];
  selectedList: readonly Ingredient[];
}>;

export function IngredientPicker({
  emptyMessage,
  isUsedOnly = false,
  label,
  onChange,
  onCreate,
  onSearchFocus,
  renderSelected,
  selectedList,
}: IngredientPickerProps) {
  const t = useMessages();
  const searchRef = useRef<TextInputInstance>(null);
  const [search, setSearch] = useState('');
  const selectedIds = new Set(selectedList.map((ingredient) => ingredient.id));
  // Exact name first, then the most used: the likeliest picks before typing.
  const suggestionList = useIngredientSuggestions({
    excludeIdList: [...selectedIds],
    isUsedOnly,
    limit: MAX_SUGGESTIONS,
    search,
  });
  const { focusMoved, forgetFocus, isFocusTarget } = useChipFocus([
    ...selectedList,
    ...suggestionList,
  ]);
  const typedName = cleanName(search);
  const isSameName = (ingredient: Ingredient) =>
    toNameKey(ingredient.name) === toNameKey(typedName);
  const canCreate =
    onCreate !== undefined &&
    typedName !== '' &&
    suggestionList.every((ingredient) => !isSameName(ingredient)) &&
    selectedList.every((ingredient) => !isSameName(ingredient));
  useSearchAnnouncement(
    typedName,
    typedName ? t.ingredientPicker.resultSummary(suggestionList.length, canCreate) : undefined,
  );

  const select = (ingredient: Ingredient) => {
    if (!selectedIds.has(ingredient.id)) {
      onChange([...selectedList, ingredient]);
    }
    focusMoved(ingredient);
    setSearch('');
  };
  const remove = (ingredient: Ingredient) => {
    onChange(selectedList.filter((item) => item.id !== ingredient.id));
    focusMoved(ingredient);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <SelectedIngredients
        isFocusTarget={isFocusTarget}
        onRemove={remove}
        renderSelected={renderSelected}
        selectedList={selectedList}
      />
      <TextField
        autoCapitalize="none"
        isLabelHidden
        label={t.ingredientPicker.searchLabel(label)}
        onChangeText={(text) => {
          setSearch(text);
          // Typing: no chip may take the focus from the field when the search shows it again.
          forgetFocus();
        }}
        onFocus={() => {
          if (searchRef.current) {
            onSearchFocus?.(searchRef.current);
          }
        }}
        onSubmitEditing={() => {
          if (suggestionList[0]) {
            select(suggestionList[0]);
          } else if (canCreate) {
            select(onCreate(typedName));
          }
        }}
        placeholder={
          onCreate ? t.ingredientPicker.placeholderWithCreate : t.ingredientPicker.placeholder
        }
        ref={searchRef}
        returnKeyType="done"
        submitBehavior="submit"
        value={search}
      />
      <View style={styles.chipList}>
        {suggestionList.map((ingredient) => (
          <Chip
            accessibilityHint={t.ingredientPicker.addHint}
            accessibilityLabel={t.ingredientPicker.addLabel(ingredient.name)}
            icon="plus"
            isTvPreferredFocus={isFocusTarget(ingredient)}
            key={ingredient.id}
            label={ingredient.name}
            onPress={() => select(ingredient)}
          />
        ))}
        {canCreate && (
          <Chip
            accessibilityHint={t.ingredientPicker.createHint}
            accessibilityLabel={t.ingredientPicker.createLabel(typedName)}
            icon="plus-circle-outline"
            label={t.ingredientPicker.createChip(typedName)}
            onPress={() => select(onCreate(typedName))}
          />
        )}
      </View>
      {suggestionList.length === 0 && !canCreate && (
        <Text style={styles.hint}>{search ? t.ingredientPicker.noMatch : emptyMessage}</Text>
      )}
    </View>
  );
}

// The selected ingredients: chips that remove them, or the rows `renderSelected` draws.
function SelectedIngredients({
  isFocusTarget,
  onRemove,
  renderSelected,
  selectedList,
}: SelectedIngredientsProps) {
  const t = useMessages();
  if (selectedList.length === 0) {
    return null;
  }
  if (renderSelected) {
    return (
      <View style={styles.selectedList}>
        {selectedList.map((ingredient) => (
          <View key={ingredient.id}>{renderSelected(ingredient, () => onRemove(ingredient))}</View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.chipList}>
      {selectedList.map((ingredient) => (
        <Chip
          accessibilityHint={t.ingredientPicker.removeHint}
          accessibilityLabel={t.ingredientPicker.removeLabel(ingredient.name)}
          icon="close"
          isFilled
          isTvPreferredFocus={isFocusTarget(ingredient)}
          key={ingredient.id}
          label={ingredient.name}
          onPress={() => onRemove(ingredient)}
        />
      ))}
    </View>
  );
}

// On a TV, the chip an ingredient just moved to (selected or suggested) takes the remote's focus:
// the pressed chip disappears, and Android would otherwise send the focus to the top of the screen.
// When the search or the suggestion limit hides that chip, the first chip shown takes it instead.
function useChipFocus(shownList: readonly Ingredient[]) {
  const [movedId, setMovedId] = useState<number>();
  // The pending request to focus the moved chip: cancelled when the user moves on.
  const pendingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const forgetFocus = () => {
    clearTimeout(pendingTimer.current);
    setMovedId(undefined);
  };
  const shownIdList = shownList.map((ingredient) => ingredient.id);
  const targetId =
    movedId === undefined || shownIdList.includes(movedId) ? movedId : shownIdList[0];

  return {
    focusMoved: (ingredient: Ingredient) => {
      if (!isTv) {
        return;
      }

      // The chip shows up first; it's asked to take the focus on the next render, once on screen.
      forgetFocus();
      pendingTimer.current = setTimeout(() => setMovedId(ingredient.id), 0);
    },
    forgetFocus,
    isFocusTarget: (ingredient: Ingredient) => isTv && ingredient.id === targetId,
  };
}

// Screen readers hear what a search found once typing pauses: the suggestions change as you type,
// out of the field the screen reader is on.
function useSearchAnnouncement(search: string, summary: string | undefined) {
  useEffect(() => {
    const timer =
      summary === undefined
        ? undefined
        : setTimeout(() => AccessibilityInfo.announceForAccessibility(summary), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, summary]);
}

const styles = StyleSheet.create((theme) => ({
  // No space between lines: the chips' touch areas leave it.
  chipList: {
    columnGap: theme.gap(2),
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  selectedList: {
    gap: theme.gap(3),
  },
}));
