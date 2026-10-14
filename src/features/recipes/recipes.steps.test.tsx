import { fireEvent, screen } from '@testing-library/react-native';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import {
  findIngredientByName,
  findOrCreateIngredient,
} from '@/features/ingredients/db/ingredient-queries';
import { firstRecipePage } from '@/test/queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { getRecipe } from './db/recipe-queries';
import { RecipeFormScreen } from './recipe-form-screen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useLocalSearchParams: () => ({}),
}));

const feature = loadFeature('./recipes.feature', { loadRelativePath: true });

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createTestConnection();
  });

  const startNewRecipe = async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);
  };

  const saveTheRecipe = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));
  };

  test('A recipe is written with existing and new ingredients', ({ and, given, then, when }) => {
    given(/^the ingredient "(.*)" exists$/, (name: string) => {
      findOrCreateIngredient(connection.db, name);
    });
    and('I am writing a new recipe', startNewRecipe);
    when(/^I give it the title "(.*)"$/, async (title: string) => {
      await fireEvent.changeText(screen.getByLabelText('Title'), title);
    });
    and(/^I choose the "(.*)" season$/, async (season: string) => {
      await fireEvent.press(screen.getByRole('radio', { name: season }));
    });
    and(/^I add the existing ingredient "(.*)"$/, async (name: string) => {
      await fireEvent.press(screen.getByRole('button', { name: `Add ${name}` }));
    });
    and(/^I add the new ingredient "(.*)"$/, async (name: string) => {
      await fireEvent.changeText(screen.getByLabelText('Search ingredients'), name);
      await fireEvent.press(screen.getByRole('button', { name: `Create ${name}` }));
    });
    and('I save the recipe', saveTheRecipe);
    then(
      /^the recipe "(.*)" is saved for winter with "(.*)"$/,
      (title: string, ingredientNames: string) => {
        const [{ id } = { id: -1 }] = firstRecipePage(connection.db);

        expect(getRecipe(connection.db, id)).toMatchObject({ season: 'winter', title });
        expect(
          getRecipe(connection.db, id)?.ingredientList.map((ingredient) => ingredient.name),
        ).toStrictEqual(ingredientNames.split(', '));
      },
    );
    and(/^"(.*)" is now in the ingredient list$/, (name: string) => {
      expect(findIngredientByName(connection.db, name)).toBeDefined();
    });
  });

  test('A recipe needs a title', ({ given, then, when }) => {
    given('I am writing a new recipe', startNewRecipe);
    when('I save the recipe', saveTheRecipe);
    then('I am asked to give the recipe a title', () => {
      expect(screen.getByText('Give the recipe a title.')).toBeOnTheScreen();
      expect(firstRecipePage(connection.db)).toStrictEqual([]);
    });
  });

  test('A recipe written in Markdown is previewed formatted', ({ given, then, when }) => {
    given('I am writing a new recipe', startNewRecipe);
    when(/^I write "(.*)" as the recipe$/, async (text: string) => {
      await fireEvent.changeText(screen.getByLabelText('Recipe text'), text);
    });
    when(/^I switch to "(.*)"$/, async (mode: string) => {
      await fireEvent.press(screen.getByRole('radio', { name: mode }));
    });
    then(/^I see "(.*)" with "(.*)" in bold$/, (text: string, boldText: string) => {
      expect(screen.getByText(text)).toBeOnTheScreen();
      expect(screen.getByText(boldText)).toHaveStyle({ fontWeight: '700' });
      expect(screen.queryByLabelText('Recipe text')).not.toBeOnTheScreen();
    });
    when(/^I switch to "(.*)"$/, async (mode: string) => {
      await fireEvent.press(screen.getByRole('radio', { name: mode }));
    });
    then(/^the recipe text is still "(.*)"$/, (text: string) => {
      expect(screen.getByLabelText('Recipe text')).toHaveDisplayValue(text);
    });
  });
});
