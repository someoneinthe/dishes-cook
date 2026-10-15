import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Markdown } from '@/components/markdown';
import { usePreferences } from '@/features/settings/preferences';
import { useMessages } from '@/i18n/i18n-provider';
import type { Recipe } from '../db/recipe-queries';
import { formatQuantity } from '../quantity';
import { CourseLabel, SeasonLabel } from './recipe-labels';

type RecipeDetailsProps = Readonly<{ recipe: Recipe }>;

// The content of a recipe, shared by the recipe screen and the meal choice suggestion.
export function RecipeDetails({ recipe }: RecipeDetailsProps) {
  const t = useMessages();
  // Quantities in the reader's units (Settings › Units).
  const { units } = usePreferences();
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {recipe.title}
      </Text>
      <View style={styles.labels}>
        <SeasonLabel season={recipe.season} />
        <CourseLabel course={recipe.course} />
      </View>

      <Text accessibilityRole="header" style={styles.heading}>
        {t.recipes.ingredients}
      </Text>
      {recipe.ingredientList.length > 0 ? (
        <View accessibilityRole="list">
          {recipe.ingredientList.map(({ id, name, quantity }) => (
            <Text key={id} style={styles.text}>
              {`• ${quantity ? t.quantities.line(name, formatQuantity(t, quantity, units)) : name}`}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>{t.recipes.noIngredients}</Text>
      )}

      <Text accessibilityRole="header" style={styles.heading}>
        {t.recipes.recipe}
      </Text>
      {recipe.instructions ? (
        <Markdown text={recipe.instructions} />
      ) : (
        <Text style={styles.muted}>{t.recipes.noInstructions}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.gap(2),
  },
  heading: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
    marginTop: theme.gap(2),
  },
  labels: {
    columnGap: theme.gap(4),
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: theme.gap(1),
  },
  muted: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
}));
