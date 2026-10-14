import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import { saveRecipe } from '@/features/recipes/db/recipe-queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { MealChoiceScreen } from './meal-choice-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const feature = loadFeature('./meal-choice.feature', { loadRelativePath: true });

const RECIPE_TITLE_LIST = ['Pumpkin soup', 'Tomato salad', 'Omelette'];

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

  const theseRecipes = (rowList: Readonly<{ title: string }>[]) => {
    for (const { title } of rowList) {
      const id = saveRecipe(connection.db, {
        ingredientIdList: [],
        instructions: '',
        season: 'both',
        title,
      });
      idByTitle.set(title, id);
    }
  };

  // Title of the suggested recipe, shown as a header on its card.
  const currentSuggestion = () =>
    RECIPE_TITLE_LIST.find((title) => screen.queryByRole('header', { name: title }));

  const openTheMealChoice = async () => {
    await renderWithDatabase(<MealChoiceScreen />, connection);
    firstSuggestion = currentSuggestion();
  };

  test('A recipe is proposed as soon as the meal choice opens', ({ given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    then(/^the suggestion is one of "(.*)"$/, (titles: string) => {
      expect(titles.split(', ')).toContain(currentSuggestion());
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

  test('The suggestion offers another one', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and('I ask the suggestion for another one', async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Another one' }));
    });
    then('the two suggestions are different', () => {
      expect(firstSuggestion).toBeDefined();
      expect(currentSuggestion()).not.toBe(firstSuggestion);
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
