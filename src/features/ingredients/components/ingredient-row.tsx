import { useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useDatabase } from '@/db/database-context';
import type { IngredientListItem } from '../db/ingredient-queries';
import { renameIngredient } from '../db/ingredient-queries';

type IngredientRowProps = Readonly<{
  ingredient: IngredientListItem;
  onDelete: (ingredient: IngredientListItem) => void;
}>;

const RENAME_ERRORS = {
  blank: 'The name cannot be empty.',
  duplicate: 'Another ingredient already has this name.',
};

export function IngredientRow({ ingredient, onDelete }: IngredientRowProps) {
  const database = useDatabase();
  const [draftName, setDraftName] = useState<string>();
  const [error, setError] = useState<string>();

  if (draftName !== undefined) {
    const save = () => {
      const result = renameIngredient(database, ingredient.id, draftName);
      if (result === 'renamed') {
        setDraftName(undefined);
      } else {
        setError(RENAME_ERRORS[result]);
      }
    };
    return (
      <View style={styles.editRow}>
        <TextField
          autoFocus
          error={error}
          label={`Rename ${ingredient.name}`}
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
            label="Cancel"
            onPress={() => {
              setDraftName(undefined);
              setError(undefined);
            }}
            variant="secondary"
          />
          <Button icon="check" isIconOnly label="Save" onPress={save} />
        </View>
      </View>
    );
  }

  const isUsed = ingredient.recipeCount > 0;
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.name}>{ingredient.name}</Text>
        <Text style={styles.usage}>{describeUsage(ingredient.recipeCount)}</Text>
      </View>
      <View style={styles.actions}>
        <Button
          accessibilityHint="Lets you edit its name"
          accessibilityLabel={`Rename ${ingredient.name}`}
          icon="pencil"
          isIconOnly
          label="Rename"
          onPress={() => setDraftName(ingredient.name)}
          variant="secondary"
        />
        {/* An ingredient used by recipes can't be deleted (the database refuses it too). */}
        {!isUsed && (
          <Button
            accessibilityHint="Asks for confirmation first"
            accessibilityLabel={`Delete ${ingredient.name}`}
            icon="trash-can-outline"
            isIconOnly
            label="Delete"
            onPress={() => onDelete(ingredient)}
            variant="danger"
          />
        )}
      </View>
    </View>
  );
}

function describeUsage(recipeCount: number): string {
  if (recipeCount === 0) {
    return 'Not used yet';
  }
  return recipeCount === 1 ? 'Used in 1 recipe' : `Used in ${recipeCount} recipes`;
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
