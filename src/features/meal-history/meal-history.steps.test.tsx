import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { MealChoiceScreen } from '@/features/meal-choice/meal-choice-screen';
import { saveRecipe } from '@/features/recipes/db/recipe-queries';
import { RecipeDetailScreen } from '@/features/recipes/recipe-detail-screen';
import { updatePreferences } from '@/features/settings/preferences';
import { spyOnAlert } from '@/test/alert';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { markCooked } from './db/cooked-meal-queries';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useIsFocused: () => true,
  useLocalSearchParams: jest.fn(),
}));

const feature = loadFeature('./meal-history.feature', { loadRelativePath: true });

const DAY = 24 * 60 * 60 * 1000;

// "never", or the days it was cooked: "10 days ago, 3 days ago".
type RecipeRow = Readonly<{ cooked: string; title: string }>;

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let alert: ReturnType<typeof spyOnAlert>;
  const idByTitle = new Map<string, number>();
  const suggestedSet = new Set<string>();

  beforeEach(() => {
    connection = createTestConnection();
    alert = spyOnAlert();
    idByTitle.clear();
    suggestedSet.clear();
    // The default: the last 14 days.
    updatePreferences({ recentMealDays: 14 });
  });

  const theseRecipes = (rowList: RecipeRow[]) => {
    for (const { cooked, title } of rowList) {
      const id = saveRecipe(connection.db, {
        ingredientIdList: [],
        instructions: '',
        season: 'both',
        title,
      });
      idByTitle.set(title, id);
      // "never" is no day; "3 days ago" starts with its number.
      for (const text of cooked.split(', ')) {
        if (text !== 'never') {
          markCooked(connection.db, id, Date.now() - Number(text.split(' ', 1)[0]) * DAY);
        }
      }
    }
  };

  // Title of the suggested recipe, shown as a header on its card.
  const currentSuggestion = () =>
    [...idByTitle.keys()].find((title) => screen.queryByRole('header', { name: title }));
  const rememberSuggestion = () => {
    const title = currentSuggestion();
    if (title) {
      suggestedSet.add(title);
    }
  };

  const openTheMealChoice = async () => {
    await renderWithDatabase(<MealChoiceScreen />, connection);
    rememberSuggestion();
  };
  const askForAnotherSuggestion = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Suggest another one' }));
    rememberSuggestion();
  };
  const openTheRecipe = async (title: string) => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(idByTitle.get(title)) });
    await renderWithDatabase(<RecipeDetailScreen />, connection);
  };
  const theSuggestionIs = (title: string) => {
    expect(currentSuggestion()).toBe(title);
  };
  const indexSee = (text: string) => {
    expect(screen.getByText(text)).toBeOnTheScreen();
  };

  test('The suggestion can be marked as cooked', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and('I say I cooked the suggestion', async () => {
      expect(screen.getByText('Not cooked yet')).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'I cooked it' }));
    });
    then(/^the suggestion says "(.*)"$/, indexSee);
    and("it can't be marked as cooked again today", () => {
      expect(screen.queryByRole('button', { name: 'I cooked it' })).not.toBeOnTheScreen();
    });
  });

  test('A recipe shows when it was last cooked', ({ given, then, when }) => {
    given('these recipes:', theseRecipes);
    when(/^I open "(.*)"$/, openTheRecipe);
    then(/^I see "(.*)"$/, indexSee);
  });

  test('The last time cooked can be removed, after confirming', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when(/^I open "(.*)"$/, openTheRecipe);
    and('I remove the last time it was cooked', async () => {
      await fireEvent.press(
        screen.getByRole('button', { name: 'Remove the last time it was cooked' }),
      );

      expect(alert.spy).toHaveBeenLastCalledWith(
        'Delete “Cooked 3 days ago”?',
        'Only this date is removed, not the recipe.',
        expect.any(Array),
      );
    });
    and('I confirm the removal', async () => {
      await alert.press('Delete');
    });
    then(/^I see "(.*)"$/, indexSee);
  });

  test('The meal choice skips the recipes cooked recently', ({ given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    then(/^the suggestion is "(.*)"$/, theSuggestionIs);
    when('I ask for another suggestion', askForAnotherSuggestion);
    then(/^the suggestion is "(.*)"$/, theSuggestionIs);
  });

  test('The recipes cooked before the last 14 days are proposed again', ({ given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    then(/^the suggestion is "(.*)"$/, theSuggestionIs);
  });

  test('When every recipe was cooked recently, the one cooked longest ago is proposed', ({
    given,
    then,
    when,
  }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    then(/^the suggestion is "(.*)"$/, theSuggestionIs);
  });

  test('Recent meals are proposed too when the setting is off', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    and("recent meals aren't skipped", () => {
      updatePreferences({ recentMealDays: 0 });
    });
    when('I open the meal choice', openTheMealChoice);
    and('I ask for another suggestion', askForAnotherSuggestion);
    then('both recipes were suggested', () => {
      expect(suggestedSet).toStrictEqual(new Set(['Omelette', 'Pumpkin soup']));
    });
  });
});
