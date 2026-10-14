import { useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useDatabase } from '@/db/database-context';
import { useMessages } from '@/i18n/i18n-provider';
import type { IngredientListItem } from '../db/ingredient-queries';
import { renameIngredient } from '../db/ingredient-queries';

type IngredientRowProps = Readonly<{
  ingredient: IngredientListItem;
  onDelete: (ingredient: IngredientListItem) => void;
}>;

export function IngredientRow({ ingredient, onDelete }: IngredientRowProps) {
  const database = useDatabase();
  const t = useMessages();
  const [draftName, setDraftName] = useState<string>();
  const [error, setError] = useState<string>();

  if (draftName !== undefined) {
    const save = () => {
      const result = renameIngredient(database, ingredient.id, draftName);
      if (result === 'renamed') {
        setDraftName(undefined);
      } else {
        setError(result === 'blank' ? t.ingredients.nameBlank : t.ingredients.nameTaken);
      }
    };
    return (
      <View style={styles.editRow}>
        <TextField
          autoFocus
          error={error}
          label={t.ingredients.renameLabel(ingredient.name)}
          onChangeText={(text) => {
            setDraftName(text);
            setError(undefined);
          }}
          onSubmitEditing={save}
          returnKeyType="done"
          value={draftName}
        />
        <View style={styles.actions}>
          <Button
            icon="close"
            isIconOnly
            label={t.common.cancel}
            onPress={() => {
              setDraftName(undefined);
              setError(undefined);
            }}
            variant="secondary"
          />
          <Button icon="check" isIconOnly label={t.common.save} onPress={save} />
        </View>
      </View>
    );
  }

  const isUsed = ingredient.recipeCount > 0;
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.name}>{ingredient.name}</Text>
        <Text style={styles.usage}>{t.ingredients.usage(ingredient.recipeCount)}</Text>
      </View>
      <View style={styles.actions}>
        <Button
          accessibilityHint={t.ingredients.renameHint}
          accessibilityLabel={t.ingredients.renameLabel(ingredient.name)}
          icon="pencil"
          isIconOnly
          label={t.ingredients.rename}
          onPress={() => setDraftName(ingredient.name)}
          variant="secondary"
        />
        {/* An ingredient used by recipes can't be deleted (the database refuses it too). */}
        {!isUsed && (
          <Button
            accessibilityHint={t.common.deleteHint}
            accessibilityLabel={t.ingredients.deleteLabel(ingredient.name)}
            icon="trash-can-outline"
            isIconOnly
            label={t.common.delete}
            onPress={() => onDelete(ingredient)}
            variant="danger"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  actions: {
    flexDirection: 'row',
    gap: theme.gap(2),
    justifyContent: 'flex-end',
  },
  editRow: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    gap: theme.gap(2),
    padding: theme.gap(3),
  },
  name: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  row: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    flexDirection: 'row',
    // Large fonts or button labels: the buttons go under the name rather than squeezing it.
    flexWrap: 'wrap',
    gap: theme.gap(2),
    justifyContent: 'flex-end',
    padding: theme.gap(3),
  },
  text: {
    flexBasis: theme.size.minText,
    flexGrow: 1,
    gap: theme.gap(0.5),
  },
  usage: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
}));
