import type { AppDatabase } from '@/db/types';
import type { RecipeFilterValues } from '@/features/recipes/components/recipe-filters';
import { toQueryFilters } from '@/features/recipes/components/recipe-filters';
import { getRecipeSyncId, pickRandomRecipeId } from '@/features/recipes/db/recipe-queries';
import { getPreferences } from '@/features/settings/preferences';
import { getPicks } from '@/features/shopping-list/meal-picks';
import { startOfLastDays } from '@/lib/dates';
import { getSuggestedSince, recordSuggestion, startOfDelay } from './recent-suggestions';

// The meal choice's next suggestion: a random dish matching the filters, other than `excludedId`
// when another one matches. Skips the meals in the shopping list, then those cooked recently
// (Settings › Skip recent meals) and those suggested recently (Settings › Suggest a meal again
// after) while others match. The one picked is remembered at once as suggested now.
export function pickSuggestion(
  database: AppDatabase,
  values: RecipeFilterValues,
  excludedId?: number,
): number | undefined {
  // Read when picking: a meal just added to the list, or a setting just changed, counts at once.
  const { recentMealDays, suggestionDelayHours } = getPreferences();
  const id = pickRandomRecipeId(database, toQueryFilters(values, '', 'dish'), {
    excludedId,
    omittedSyncIdList: getPicks(),
    recentlySuggestedSyncIdList: getSuggestedSince(startOfDelay(suggestionDelayHours)),
    skipCookedSince: recentMealDays === 0 ? undefined : startOfLastDays(recentMealDays),
  });
  const syncId = id === undefined ? undefined : getRecipeSyncId(database, id);
  if (syncId !== undefined) {
    recordSuggestion(syncId);
  }
  return id;
}
