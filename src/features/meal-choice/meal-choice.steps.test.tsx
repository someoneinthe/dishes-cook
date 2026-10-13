import { fireEvent, screen } from '@testing-library/react-native';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { Course, Season } from '@/db/schema';
import type { DatabaseConnection } from '@/db/types';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { saveRecipe } from '@/features/recipes/db/recipe-queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { MealChoiceScreen } from './meal-choice-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const feature = loadFeature('./meal-choice.feature', { loadRelativePath: true });

const RECIPE_TITLE_LIST = ['Pumpkin soup', 'Tomato salad', 'Omelette'];

// An empty course cell is a recipe without a course.
type RecipeRow = Readonly<{
  course: '' | Course;
  ingredients: string;
  season: Season;
  title: string;
}>;

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let previousSuggestion: string | undefined;

  beforeEach(() => {
    connection = createTestConnection();
    previousSuggestion = undefined;
  });

  const theseRecipes = (rowList: RecipeRow[]) => {
    for (const row of rowList) {
      const ingredientIdList = row.ingredients
        .split(',')
        .map((name) => findOrCreateIngredient(connection.db, name).id);
      saveRecipe(connection.db, {
        course: row.course || null,
        ingredientIdList,
        instructions: '',
        season: row.season,
        title: row.title,
      });
    }
  };

  const openTheMealChoice = async () => {
    await renderWithDatabase(<MealChoiceScreen />, connection);
  };

  // A season or a course.
  const chooseTheOption = async (option: string) => {
    await fireEvent.press(screen.getByRole('radio', { name: option }));
  };

  const selectTheIngredient = async (name: string) => {
    await fireEvent.press(screen.getByRole('button', { name: `Add ${name}` }));
  };

  const askForSuggestion = async () => {
    await fireEvent.press(screen.getByRole('button', { name: /^Suggest/ }));
  };

  // Title of the suggested recipe, shown as a header.
  const currentSuggestion = () =>
    RECIPE_TITLE_LIST.find((title) => screen.queryByRole('header', { name: title }));

  // Assertions stay inline in each `then` (not in shared step functions) so Sonar sees them (S2699).
  const matchCountText = (count: string) =>
    count === '1' ? '1 recipe matches.' : `${count} recipes match.`;

  const isSuggestionOneOf = (titles: string) =>
    titles.split(', ').some((title) => screen.queryByRole('header', { name: title }));

  test('Any recipe can be suggested without filters', ({ given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    then(/^I see that (\d+) recipes match$/, (count: string) => {
      expect(screen.getByText(matchCountText(count))).toBeOnTheScreen();
    });
    when('I ask for a suggestion', askForSuggestion);
    then(/^the suggestion is one of "(.*)"$/, (titles: string) => {
      expect(isSuggestionOneOf(titles)).toBe(true);
    });
  });

  test('A season also includes the recipes for both seasons', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and(/^I choose the "(.*)" season$/, chooseTheOption);
    then(/^I see that (\d+) recipes match$/, (count: string) => {
      expect(screen.getByText(matchCountText(count))).toBeOnTheScreen();
    });
    when('I ask for a suggestion', askForSuggestion);
    then(/^the suggestion is one of "(.*)"$/, (titles: string) => {
      expect(isSuggestionOneOf(titles)).toBe(true);
    });
  });

  test('A course keeps only the recipes of that course', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and(/^I choose the "(.*)" course$/, chooseTheOption);
    then(/^I see that (\d+) recipe matches$/, (count: string) => {
      expect(screen.getByText(matchCountText(count))).toBeOnTheScreen();
    });
    when('I ask for a suggestion', askForSuggestion);
    then(/^the suggestion is one of "(.*)"$/, (titles: string) => {
      expect(isSuggestionOneOf(titles)).toBe(true);
    });
  });

  test('Suggested recipes contain every selected ingredient', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and(/^I select the ingredient "(.*)"$/, selectTheIngredient);
    and(/^I select the ingredient "(.*)"$/, selectTheIngredient);
    then(/^I see that (\d+) recipe matches$/, (count: string) => {
      expect(screen.getByText(matchCountText(count))).toBeOnTheScreen();
    });
    when('I ask for a suggestion', askForSuggestion);
    then(/^the suggestion is one of "(.*)"$/, (titles: string) => {
      expect(isSuggestionOneOf(titles)).toBe(true);
    });
  });

  test('Asking again suggests another recipe', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and(/^I choose the "(.*)" season$/, chooseTheOption);
    and('I ask for a suggestion', async () => {
      await askForSuggestion();
      previousSuggestion = currentSuggestion();
    });
    and('I ask for another suggestion', askForSuggestion);
    then('the two suggestions are different', () => {
      expect(previousSuggestion).toBeDefined();
      expect(currentSuggestion()).not.toBe(previousSuggestion);
    });
  });

  test('Nothing can be suggested when no recipe matches', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and(/^I choose the "(.*)" season$/, chooseTheOption);
    and(/^I select the ingredient "(.*)"$/, selectTheIngredient);
    then('I see that no recipe matches', () => {
      expect(screen.getByText('No recipe matches these filters.')).toBeOnTheScreen();
    });
    and('I cannot ask for a suggestion', () => {
      expect(screen.getByRole('button', { name: 'Suggest a recipe' })).toBeDisabled();
    });
  });
});
