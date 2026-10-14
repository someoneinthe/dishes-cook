import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Recipe } from '@/features/recipes/db/recipe-queries';
import { Button } from '@/components/button';
import { CourseLabel, SeasonLabel } from '@/features/recipes/components/recipe-labels';
import { useMessages } from '@/i18n/i18n-provider';

type SuggestionCardProps = Readonly<{
  // Picks another recipe with the same filters.
  onAnother: () => void;
  recipe: Recipe;
}>;

// The suggested recipe, in short: Open shows it in full, Another one picks again.
export function SuggestionCard({ onAnother, recipe }: SuggestionCardProps) {
  const t = useMessages();

  return (
    // Announced when a new suggestion appears.
    <View accessibilityLiveRegion="polite" style={styles.card}>
      <Text style={styles.intro}>{t.mealChoice.suggestionIntro}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {recipe.title}
      </Text>
      <View style={styles.details}>
        <SeasonLabel season={recipe.season} />
        <CourseLabel course={recipe.course} />
        <Text style={styles.detail}>{t.recipes.ingredientCount(recipe.ingredientList.length)}</Text>
      </View>
      <View style={styles.actions}>
        <Button
          accessibilityHint={t.mealChoice.suggestHint}
          icon="dice-multiple"
          label={t.mealChoice.another}
          onPress={onAnother}
          variant="secondary"
        />
        <Button
          accessibilityHint={t.recipes.openHint}
          accessibilityLabel={t.mealChoice.openLabel(recipe.title)}
          label={t.mealChoice.open}
          onPress={() =>
            router.push({ params: { id: String(recipe.id) }, pathname: '/recipe/[id]' })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth,
    gap: theme.gap(2),
    padding: theme.gap(4),
  },
  detail: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  details: {
    alignItems: 'center',
    columnGap: theme.gap(4),
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: theme.gap(1),
  },
  intro: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
}));
