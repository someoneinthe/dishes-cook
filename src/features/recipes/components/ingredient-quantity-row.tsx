import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { Unit } from '@/lib/units';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { usePreferences } from '@/features/settings/preferences';
import { useMessages } from '@/i18n/i18n-provider';
import { parseAmount, unitOptionList } from '@/lib/units';

// What the form holds for an ingredient's quantity: the amount as typed, and its unit (none =
// pieces). An empty amount = no quantity.
export type QuantityDraft = Readonly<{ amountText: string; unit?: Unit }>;

type IngredientQuantityRowProps = Readonly<{
  draft: QuantityDraft;
  error?: string;
  ingredient: Ingredient;
  onChange: (draft: QuantityDraft) => void;
  onRemove: () => void;
}>;

type UnitPickerProps = Readonly<{
  onChoose: (unit: undefined | Unit) => void;
  onClose: () => void;
  title: string;
  unit: undefined | Unit;
}>;

// A selected ingredient of the recipe form: remove it, or give its quantity and unit.
export function IngredientQuantityRow({
  draft,
  error,
  ingredient,
  onChange,
  onRemove,
}: IngredientQuantityRowProps) {
  const t = useMessages();
  const [isChoosingUnit, setIsChoosingUnit] = useState(false);
  // The unit button follows the amount ("1 clove", "2 cloves"); plural while it's empty.
  const amount = parseAmount(draft.amountText) ?? 2;
  const unitName = (unit: undefined | Unit) =>
    unit === undefined ? t.quantities.pieces : t.quantities.unit(unit, amount);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Chip
          accessibilityHint={t.ingredientPicker.removeHint}
          accessibilityLabel={t.ingredientPicker.removeLabel(ingredient.name)}
          icon="close"
          isSelected
          label={ingredient.name}
          onPress={onRemove}
        />
        <View style={styles.quantity}>
          <View style={styles.amount}>
            <TextField
              isInvalid={error !== undefined}
              isLabelHidden
              keyboardType="decimal-pad"
              label={t.quantities.amountLabel(ingredient.name)}
              onChangeText={(amountText) => onChange({ ...draft, amountText })}
              placeholder={t.quantities.amountPlaceholder}
              value={draft.amountText}
            />
          </View>
          <Button
            accessibilityHint={t.quantities.unitButtonHint}
            accessibilityLabel={t.quantities.unitButtonLabel(ingredient.name, unitName(draft.unit))}
            icon="chevron-down"
            label={unitName(draft.unit)}
            onPress={() => setIsChoosingUnit(true)}
            variant="secondary"
          />
        </View>
      </View>
      {/* Under the whole row: in the field, it would stretch it and push the unit away. */}
      {error !== undefined && (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {isChoosingUnit && (
        <UnitPicker
          onChoose={(unit) => {
            onChange({ ...draft, unit });
            setIsChoosingUnit(false);
          }}
          onClose={() => setIsChoosingUnit(false)}
          title={t.quantities.chooseUnit(ingredient.name)}
          unit={draft.unit}
        />
      )}
    </View>
  );
}

// The units of Settings › Units (and the current one, from the other system) in a sheet over the
// form; Back or a tap outside closes it.
function UnitPicker({ onChoose, onClose, title, unit }: UnitPickerProps) {
  const t = useMessages();
  const { units } = usePreferences();
  const optionList: readonly (undefined | Unit)[] = [undefined, ...unitOptionList(units, unit)];

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      {/* A tap outside closes it; screen readers use Cancel instead. */}
      <Pressable
        accessible={false}
        importantForAccessibility="no"
        onPress={onClose}
        style={styles.backdrop}
      />
      <View style={styles.sheet}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <ScrollView contentContainerStyle={styles.optionList}>
          {optionList.map((option) => (
            <Chip
              icon={option === unit ? 'check-circle' : 'circle-outline'}
              isSelected={option === unit}
              key={option ?? 'pieces'}
              label={option === undefined ? t.quantities.pieces : t.quantities.unit(option, 2)}
              onPress={() => onChoose(option)}
            />
          ))}
        </ScrollView>
        <Button label={t.common.cancel} onPress={onClose} variant="secondary" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  amount: {
    minWidth: theme.gap(20),
  },
  backdrop: {
    backgroundColor: theme.colors.overlay,
    flex: 1,
  },
  container: {
    gap: theme.gap(1),
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  quantity: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    gap: theme.gap(4),
    maxHeight: '70%',
    padding: theme.gap(4),
  },
  title: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
  },
}));
