import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import { Button } from '@/components/button';
import { useMessages } from '@/i18n/i18n-provider';

type SelectedIngredientProps = Readonly<{
  // The row (name, quantity).
  children: ReactNode;
  // The new ingredient, as read from the photo.
  ingredient: Ingredient;
  // Save was pressed before choosing: the question turns into an error.
  isChoiceMissing: boolean;
  onChooseSimilar: (similar: Ingredient) => void;
  onKeepNew: () => void;
  // The existing ingredient this new one looks like, while the user hasn't chosen.
  similar: Ingredient | undefined;
}>;

// An ingredient of the recipe form. A new one read from a photo that looks like an existing one
// ("carrot" / "Carrots") asks which to keep, so the list doesn't get the same ingredient twice.
export function SelectedIngredient({
  children,
  ingredient,
  isChoiceMissing,
  onChooseSimilar,
  onKeepNew,
  similar,
}: SelectedIngredientProps) {
  const t = useMessages();
  if (!similar) {
    return <>{children}</>;
  }
  return (
    <View style={styles.container}>
      {children}
      <Text
        accessibilityLiveRegion="polite"
        accessibilityRole={isChoiceMissing ? 'alert' : 'text'}
        style={isChoiceMissing ? styles.error : styles.message}
      >
        {isChoiceMissing
          ? t.recipeScan.choiceRequired(similar.name)
          : t.recipeScan.similarMessage(similar.name)}
      </Text>
      <View style={styles.buttonRow}>
        <Button
          accessibilityHint={t.recipeScan.useSimilarHint}
          label={t.recipeScan.useSimilar(similar.name)}
          onPress={() => onChooseSimilar(similar)}
          variant="secondary"
        />
        <Button
          accessibilityHint={t.recipeScan.keepNewHint}
          accessibilityLabel={t.recipeScan.keepNewLabel(ingredient.name)}
          label={t.recipeScan.keepNew}
          onPress={onKeepNew}
          variant="secondary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  container: {
    gap: theme.gap(2),
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
  message: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
}));
