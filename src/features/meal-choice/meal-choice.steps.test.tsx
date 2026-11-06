import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { Course, Season } from '@/db/schema';
import type { DatabaseConnection } from '@/db/types';
import { getRecipeSyncId, saveRecipe } from '@/features/recipes/db/recipe-queries';
import { updatePreferences } from '@/features/settings/preferences';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { MealChoiceScreen } from './meal-choice-screen';
import { recordSuggestion } from './recent-suggestions';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useIsFocused: () => true }));

const feature = loadFeature('./meal-choice.feature', { loadRelativePath: true });

type RecipeRow = Readonly<{ course: Course; season: Season; title: string }>;

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let firstSuggestion: string | undefined;
  const idByTitle = new Map<string, number>();

  beforeEach(() => {
    connection = createTestConnection();
    firstSuggestion = undefined;
    idByTitle.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    updatePreferences({ suggestionDelayHours: 1 });
    jest.restoreAllMocks();
  });

  const theseRecipes = (rowList: RecipeRow[]) => {
    for (const { course, season, title } of rowList) {
      const id = saveRecipe(connection.db, {
        course,
        ingredientIdList: [],
        instructions: '',
        season,
        title,
      });
      idByTitle.set(title, id);
    }
  };

  // Title of the suggested recipe, shown as a header on its card.
  const currentSuggestion = () =>
    [...idByTitle.keys()].find((title) => screen.queryByRole('header', { name: title }));

  const openTheMealChoice = async () => {
    await renderWithDatabase(<MealChoiceScreen />, connection);
    firstSuggestion = currentSuggestion();
  };

  // A season or a course.
  const chooseTheOption = async (option: string) => {
    await fireEvent.press(screen.getByRole('radio', { name: option }));
  };

  test('A main course is proposed as soon as the meal choice opens', ({ given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    then(/^the suggestion is one of "(.*)"$/, (titles: string) => {
      expect(titles.split(', ')).toContain(currentSuggestion());
    });
  });

  test('Choosing a season proposes a recipe of that season', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and(/^I choose the "(.*)" season$/, chooseTheOption);
    then(/^the suggestion is one of "(.*)"$/, (titles: string) => {
      expect(titles.split(', ')).toContain(currentSuggestion());
    });
  });

  test('Choosing a course proposes a recipe of that course', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and(/^I choose the "(.*)" course$/, chooseTheOption);
    then(/^the suggestion is one of "(.*)"$/, (titles: string) => {
      expect(titles.split(', ')).toContain(currentSuggestion());
    });
  });

  test('Nothing is proposed when no recipe matches', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and(/^I choose the "(.*)" season$/, chooseTheOption);
    and(/^I choose the "(.*)" course$/, chooseTheOption);
    then('I see that no recipe matches', () => {
      expect(screen.getByText('No recipe matches these filters.')).toBeOnTheScreen();
      expect(currentSuggestion()).toBeUndefined();
    });
    and('I cannot ask for a suggestion', () => {
      expect(screen.getByRole('button', { name: 'Suggest a recipe' })).toBeDisabled();
    });
  });

  test('Asking again suggests another recipe', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and('I ask for another suggestion', async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Suggest another one' }));
    });
    then('the two suggestions are different', () => {
      expect(firstSuggestion).toBeDefined();
      expect(currentSuggestion()).not.toBe(firstSuggestion);
    });
  });

  test('Asking again goes through every matching recipe before suggesting one again', ({
    and,
    given,
    then,
    when,
  }) => {
    const suggestionList: (string | undefined)[] = [];
    given('these recipes:', theseRecipes);
    when('I open the meal choice', async () => {
      await openTheMealChoice();
      suggestionList.push(firstSuggestion);
    });
    and(/^I ask for another suggestion (\d+) times$/, async (times: string) => {
      for (let index = 0; index < Number(times); index += 1) {
        await fireEvent.press(screen.getByRole('button', { name: 'Suggest another one' }));
        suggestionList.push(currentSuggestion());
      }
    });
    then(/^the first (\d+) suggestions are all different$/, (count: string) => {
      const firstList = suggestionList.slice(0, Number(count));

      expect(firstList).not.toContain(undefined);
      expect(new Set(firstList).size).toBe(Number(count));
    });
    and('the last suggestion is the first one', () => {
      expect(suggestionList.at(-1)).toBe(suggestionList[0]);
    });
  });

  test("A recipe suggested within the chosen delay isn't suggested again", ({
    and,
    given,
    then,
    when,
  }) => {
    const HOUR = 60 * 60 * 1000;
    given('these recipes:', theseRecipes);
    given(/^I chose to suggest a meal again after "1 week"$/, () => {
      updatePreferences({ suggestionDelayHours: 168 });
    });
    and(/^"(.*)" was suggested (\d+) hours ago$/, (title: string, hours: string) => {
      recordSuggestion(
        getRecipeSyncId(connection.db, idByTitle.get(title) ?? 0)!,
        Date.now() - Number(hours) * HOUR,
      );
      // The first match in sort order ("Omelette") unless it's left out.
      jest.spyOn(Math, 'random').mockReturnValue(0);
    });
    when('I open the meal choice', openTheMealChoice);
    then(/^the suggestion is not "(.*)"$/, (title: string) => {
      expect(currentSuggestion()).toBeDefined();
      expect(currentSuggestion()).not.toBe(title);
    });
  });

  test('The suggested recipe opens in full', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and('I open the suggestion', async () => {
      await fireEvent.press(screen.getByRole('button', { name: `Open ${firstSuggestion}` }));
    });
    then("the suggested recipe's page opens", () => {
      expect(router.push).toHaveBeenCalledWith({
        params: { id: String(idByTitle.get(firstSuggestion ?? '')) },
        pathname: '/recipe/[id]',
      });
    });
  });
});
