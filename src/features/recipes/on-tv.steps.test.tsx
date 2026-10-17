import { screen } from '@testing-library/react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { IngredientsScreen } from '@/features/ingredients/ingredients-screen';
import { MealChoiceScreen } from '@/features/meal-choice/meal-choice-screen';
import { ShoppingListScreen } from '@/features/shopping-list/shopping-list-screen';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { saveRecipe } from './db/recipe-queries';
import { RecipeDetailScreen } from './recipe-detail-screen';
import { RecipeFormScreen } from './recipe-form-screen';
import { RecipesScreen } from './recipes-screen';

// The app as a TV runs it.
jest.mock('../../lib/device', () => ({ isTv: true }));

jest.mock('expo-router', () => ({
  // Records where the screen sends the user.
  Redirect: jest.fn(() => null),
  router: { back: jest.fn(), push: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useIsFocused: () => true,
  useLocalSearchParams: jest.fn(),
}));

const feature = loadFeature('./on-tv.feature', { loadRelativePath: true });

const ON_PHONE_MESSAGE =
  'Recipes are written in the app on a phone. To see them here, sync this TV with your server in Settings.';

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  const idByTitle = new Map<string, number>();

  beforeEach(() => {
    connection = createTestConnection();
    idByTitle.clear();
    jest.mocked(Redirect).mockClear();
  });

  const noRecipes = () => {
    // A new database is empty.
  };

  test('A recipe is shown without edit or delete', ({ and, given, then, when }) => {
    given(/^the recipe "(.*)" exists$/, (title: string) => {
      const id = saveRecipe(connection.db, {
        ingredientIdList: [],
        instructions: 'Simmer for 30 minutes.',
        season: 'winter',
        title,
      });
      idByTitle.set(title, id);
    });
    when(/^I open "(.*)" on the TV$/, async (title: string) => {
      jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(idByTitle.get(title)) });
      await renderWithDatabase(<RecipeDetailScreen />, connection);
    });
    then(/^I can read "(.*)"$/, (title: string) => {
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
      expect(screen.getByText('Simmer for 30 minutes.')).toBeOnTheScreen();
    });
    and("it can't be edited or deleted", () => {
      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    });
  });

  test("Recipes can't be added on the TV", ({ and, given, then, when }) => {
    given('there are no recipes', noRecipes);
    when('I open the recipe list on the TV', async () => {
      await renderWithDatabase(<RecipesScreen />, connection);
    });
    then('I am told that recipes are written in the app on a phone, to sync with the TV', () => {
      expect(screen.getByText(ON_PHONE_MESSAGE)).toBeOnTheScreen();
    });
    and('no recipe can be added', () => {
      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    });
  });

  test("The meal choice doesn't offer to add a recipe on the TV", ({ and, given, then, when }) => {
    given('there are no recipes', noRecipes);
    when('I open the meal choice on the TV', async () => {
      await renderWithDatabase(<MealChoiceScreen />, connection);
    });
    then('I am told that recipes are written in the app on a phone, to sync with the TV', () => {
      expect(screen.getByText(ON_PHONE_MESSAGE)).toBeOnTheScreen();
    });
    and('no recipe can be added', () => {
      // Only the (disabled) Suggest button, as on a phone.
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Suggest a recipe' })).toBeDisabled();
    });
  });

  test('Links to the writing screens lead to the meal choice on the TV', ({ then, when }) => {
    when('I open the new recipe form on the TV', async () => {
      jest.mocked(useLocalSearchParams).mockReturnValue({});
      await renderWithDatabase(<RecipeFormScreen />, connection);
    });
    then('I am taken to the meal choice', () => {
      expect(jest.mocked(Redirect).mock.calls.at(-1)?.[0]).toStrictEqual({ href: '/' });
      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    });
    when('I open the ingredient list on the TV', async () => {
      await renderWithDatabase(<IngredientsScreen />, connection);
    });
    then('I am taken to the meal choice', () => {
      expect(jest.mocked(Redirect).mock.calls.at(-1)?.[0]).toStrictEqual({ href: '/' });
      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    });
    when('I open the shopping list on the TV', async () => {
      jest.mocked(Redirect).mockClear();
      await renderWithDatabase(<ShoppingListScreen />, connection);
    });
    then('I am taken to the meal choice', () => {
      expect(jest.mocked(Redirect).mock.calls.at(-1)?.[0]).toStrictEqual({ href: '/' });
      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    });
  });
});
