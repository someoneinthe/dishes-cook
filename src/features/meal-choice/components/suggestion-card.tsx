import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Recipe } from '@/features/recipes/db/recipe-queries';
import { Button } from '@/components/button';
import { LastCooked } from '@/features/meal-history/components/last-cooked';
import { CourseLabel, SeasonLabel } from '@/features/recipes/components/recipe-labels';
import { MAX_PICKS } from '@/features/shopping-list/meal-picks';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';

type SuggestionCardProps = Readonly<{
  // The shopping list is full: nothing can be added.
  isAddDisabled?: boolean;
  // Adds it to the shopping list (then another one is proposed). No button on a TV.
  onAddToList: (recipeId: number) => void;
  // Picks another recipe with the same filters.
  onAnother: () => void;
  recipe: Recipe;
}>;

// The suggested recipe, in short: Open shows it in full, Another one picks again.
export function SuggestionCard({
  isAddDisabled = false,
  onAddToList,
  onAnother,
  recipe,
}: SuggestionCardProps) {
  const t = useMessages();

  return (
    <View style={styles.card}>
      <Text style={styles.intro}>{t.mealChoice.suggestionIntro}</Text>
      {/* Its title is announced when a new suggestion appears (not the whole card, buttons included). */}
      <Text accessibilityLiveRegion="polite" accessibilityRole="header" style={styles.title}>
        {recipe.title}
      </Text>
      <View style={styles.details}>
        <SeasonLabel season={recipe.season} />
        <CourseLabel course={recipe.course} />
        <Text style={styles.detail}>{t.recipes.ingredientCount(recipe.ingredientList.length)}</Text>
      </View>
      <LastCooked recipeId={recipe.id} />
      <View style={styles.actions}>
        {!isTv && (
          <Button
            accessibilityHint={
              isAddDisabled ? t.shoppingList.fullHint(MAX_PICKS) : t.shoppingList.addHint
            }
            accessibilityLabel={t.shoppingList.addLabel(recipe.title)}
            icon="cart-plus"
            isDisabled={isAddDisabled}
            label={t.shoppingList.add}
            onPress={() => onAddToList(recipe.id)}
            variant="secondary"
          />
        )}
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
