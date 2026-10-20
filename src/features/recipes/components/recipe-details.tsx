import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Markdown } from '@/components/markdown';
import { usePreferences } from '@/features/settings/preferences';
import { useMessages } from '@/i18n/i18n-provider';
import type { Recipe } from '../db/recipe-queries';
import { formatTimes } from '../minutes';
import { formatQuantity } from '../quantity';
import { CourseLabel, SeasonLabel } from './recipe-labels';
import { RecipePhoto } from './recipe-photo';

type RecipeDetailsProps = Readonly<{
  // Shown under the season and course (e.g. when it was last cooked).
  children?: ReactNode;
  recipe: Recipe;
}>;

// The content of a recipe, shared by the recipe screen and the meal choice suggestion.
export function RecipeDetails({ children, recipe }: RecipeDetailsProps) {
  const t = useMessages();
  // Quantities in the reader's units (Settings › Units).
  const { units } = usePreferences();
  const times = formatTimes(t, recipe);
  return (
    <View style={styles.container}>
      {recipe.photoFile !== undefined && (
        <RecipePhoto file={recipe.photoFile} title={recipe.title} />
      )}
      <Text accessibilityRole="header" style={styles.title}>
        {recipe.title}
      </Text>
      <View style={styles.labels}>
        <SeasonLabel season={recipe.season} />
        {recipe.kind === 'dish' && <CourseLabel course={recipe.course} />}
      </View>
      {times !== undefined && <Text style={styles.muted}>{times}</Text>}
      {children}

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
