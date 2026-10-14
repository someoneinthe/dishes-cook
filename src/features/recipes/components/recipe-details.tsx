import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Markdown } from '@/components/markdown';
import type { Recipe } from '../db/recipe-queries';
import { CourseLabel, SeasonLabel } from './recipe-labels';

type RecipeDetailsProps = Readonly<{ recipe: Recipe }>;

// The content of a recipe, shared by the recipe screen and the meal choice suggestion.
export function RecipeDetails({ recipe }: RecipeDetailsProps) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {recipe.title}
      </Text>
      <View style={styles.labels}>
        <SeasonLabel season={recipe.season} />
        {recipe.course && <CourseLabel course={recipe.course} />}
      </View>

      <Text accessibilityRole="header" style={styles.heading}>
        Ingredients
      </Text>
      {recipe.ingredientList.length > 0 ? (
        <View accessibilityRole="list">
          {recipe.ingredientList.map((ingredient) => (
            <Text key={ingredient.id} style={styles.text}>
              {`• ${ingredient.name}`}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>No ingredients listed.</Text>
      )}

      <Text accessibilityRole="header" style={styles.heading}>
        Recipe
      </Text>
      {recipe.instructions ? (
        <Markdown text={recipe.instructions} />
      ) : (
        <Text style={styles.muted}>No instructions written yet.</Text>
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
