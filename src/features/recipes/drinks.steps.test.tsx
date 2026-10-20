import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { MealChoiceScreen } from '@/features/meal-choice/meal-choice-screen';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { listRecipePage, saveRecipe } from './db/recipe-queries';
import { DrinksScreen } from './drinks-screen';
import { RecipeDetailScreen } from './recipe-detail-screen';
import { RecipeFormScreen } from './recipe-form-screen';
import { RecipesScreen } from './recipes-screen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useIsFocused: () => true,
  useLocalSearchParams: jest.fn(),
}));

const feature = loadFeature('./drinks.feature', { loadRelativePath: true });

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let drinkId: number;

  beforeEach(() => {
    connection = createTestConnection();
  });

  const save = (title: string, kind: 'dish' | 'drink') =>
    saveRecipe(connection.db, {
      ingredientIdList: [],
      instructions: '',
      kind,
      season: 'both',
      title,
    });
  const writeNewDrink = async (title: string) => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ kind: 'drink' });
    await renderWithDatabase(<RecipeFormScreen />, connection);
    await fireEvent.changeText(screen.getByLabelText('Title'), title);
  };
  const saveTheDrink = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Save drink' }));
  };
  // The titles a list shows, by their row's label ("Mojito, Winter & summer, 0 ingredients").
  const listedTitles = () =>
    screen.getAllByRole('button', { name: /ingredients?$/ }).map((row) => {
      const label = String(row.props.accessibilityLabel);
      return label.split(', ', 1)[0];
    });

  test('A drink is written without a season nor a course, and listed with the drinks only', ({
    and,
    given,
    then,
    when,
  }) => {
    given(/^the dish "(.*)" exists$/, (title: string) => {
      save(title, 'dish');
    });
    when(/^I write a new drink "(.*)"$/, writeNewDrink);
    then('the form asks for no season nor course', () => {
      expect(screen.queryByText('Season')).not.toBeOnTheScreen();
      expect(screen.queryByText('Course')).not.toBeOnTheScreen();
    });
    when('I save the drink', saveTheDrink);
    then(/^Drinks lists "(.*)" only$/, async (title: string) => {
      await renderWithDatabase(<DrinksScreen />, connection);

      expect(listedTitles()).toStrictEqual([title]);
    });
    and(/^Recipes lists "(.*)" only$/, async (title: string) => {
      await renderWithDatabase(<RecipesScreen />, connection);

      expect(listedTitles()).toStrictEqual([title]);
    });
  });

  test('A drink has a preparation time, but no cooking time', ({ and, then, when }) => {
    when(/^I write a new drink "(.*)"$/, writeNewDrink);
    then('the form asks for a preparation time but no cooking time', () => {
      expect(screen.getByLabelText('Preparation (min)')).toBeOnTheScreen();
      expect(screen.queryByLabelText('Cooking (min)')).not.toBeOnTheScreen();
    });
    when(/^I give it (\d+) minutes of preparation$/, async (minutes: string) => {
      await fireEvent.changeText(screen.getByLabelText('Preparation (min)'), minutes);
    });
    and('I save the drink', saveTheDrink);
    then(/^the drink shows "(.*)"$/, async (times: string) => {
      const [drink] = listRecipePage(connection.db, {
        filters: { ingredientIdList: [], kind: 'drink' },
        pageParam: null,
      }).itemList;
      jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(drink?.id) });
      await renderWithDatabase(<RecipeDetailScreen />, connection);

      expect(screen.getByText(times)).toBeOnTheScreen();
    });
  });

  test('The meal choice never suggests a drink', ({ given, then }) => {
    given(/^the drink "(.*)" exists$/, (title: string) => {
      save(title, 'drink');
    });
    then('the meal choice has no recipe to suggest', async () => {
      await renderWithDatabase(<MealChoiceScreen />, connection);

      expect(screen.getByRole('header', { name: 'No recipes yet' })).toBeOnTheScreen();
    });
  });

  test("A drink's page has no season, no course and no meal history", ({
    and,
    given,
    then,
    when,
  }) => {
    given(/^the drink "(.*)" exists$/, (title: string) => {
      drinkId = save(title, 'drink');
    });
    when('I open it', async () => {
      jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(drinkId) });
      await renderWithDatabase(<RecipeDetailScreen />, connection);
    });
    then('it shows no season, no course and no "I cooked it"', () => {
      expect(screen.getByRole('header', { name: 'Mojito' })).toBeOnTheScreen();
      expect(screen.queryByText('Winter & summer')).not.toBeOnTheScreen();
      expect(screen.queryByText('Main course')).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: /I cooked it/ })).not.toBeOnTheScreen();
    });
    and('it can be added to the shopping list', () => {
      expect(screen.getByRole('button', { name: 'Add to the shopping list' })).toBeOnTheScreen();
    });
  });
});
