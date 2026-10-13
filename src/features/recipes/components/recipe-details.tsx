import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Recipe } from '../db/recipe-queries';
import { describeSeason } from '../season';

type RecipeDetailsProps = Readonly<{ recipe: Recipe }>;

// The content of a recipe, shared by the recipe screen and the meal choice suggestion.
export function RecipeDetails({ recipe }: RecipeDetailsProps) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {recipe.title}
      </Text>
      <Text style={styles.season}>{describeSeason(recipe.season)}</Text>

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
      <Text selectable style={recipe.instructions ? styles.text : styles.muted}>
        {recipe.instructions || 'No instructions written yet.'}
      </Text>
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
  muted: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  season: {
    ...theme.typography.caption,
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
