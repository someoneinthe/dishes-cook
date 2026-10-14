import { screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { MealChoiceScreen } from '@/features/meal-choice/meal-choice-screen';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { saveRecipe } from './db/recipe-queries';
import { RecipeDetailScreen } from './recipe-detail-screen';
import { RecipesScreen } from './recipes-screen';

// The app as a TV runs it.
jest.mock('../../lib/device', () => ({ isTv: true }));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
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
  });

  const noRecipes = () => {
    // A new database is empty.
  };

  const noButtons = () => {
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  };

  const toldRecipesAreWrittenOnPhone = () => {
    expect(screen.getByText(ON_PHONE_MESSAGE)).toBeOnTheScreen();
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
    and("it can't be edited or deleted", noButtons);
  });

  test("Recipes can't be added on the TV", ({ and, given, then, when }) => {
    given('there are no recipes', noRecipes);
    when('I open the recipe list on the TV', async () => {
      await renderWithDatabase(<RecipesScreen />, connection);
    });
    then(
      'I am told that recipes are written in the app on a phone, to sync with the TV',
      toldRecipesAreWrittenOnPhone,
    );
    and('no recipe can be added', noButtons);
  });

  test("The meal choice doesn't offer to add a recipe on the TV", ({ and, given, then, when }) => {
    given('there are no recipes', noRecipes);
    when('I open the meal choice on the TV', async () => {
      await renderWithDatabase(<MealChoiceScreen />, connection);
    });
    then(
      'I am told that recipes are written in the app on a phone, to sync with the TV',
      toldRecipesAreWrittenOnPhone,
    );
    and('no recipe can be added', noButtons);
  });
});
