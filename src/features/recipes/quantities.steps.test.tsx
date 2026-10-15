import { act, fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { Unit } from '@/db/schema';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { updatePreferences } from '@/features/settings/preferences';
import { toStored } from '@/lib/units';
import { firstRecipePage } from '@/test/queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { RecipeDetails } from './components/recipe-details';
import { getRecipe, saveRecipe } from './db/recipe-queries';
import { RecipeFormScreen } from './recipe-form-screen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  // A step that opens an existing recipe (/recipe/[id]/edit) gives its id.
  useLocalSearchParams: jest.fn(() => ({})),
}));

const feature = loadFeature('./quantities.feature', { loadRelativePath: true });
const RECIPE_NEEDS = /^a recipe "(.*)" needs "(\d+) (.*)" of "(.*)" and "(\d+) (.*)" of "(.*)"$/;

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let ingredientNameList: string[];

  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    connection = createTestConnection();
    updatePreferences({ units: 'metric' });
  });

  const givenIngredients = (names: string) => {
    ingredientNameList = names.split(', ');
    for (const name of ingredientNameList) {
      findOrCreateIngredient(connection.db, name);
    }
  };
  const startRecipeWithThem = async (title: string) => {
    await renderWithDatabase(<RecipeFormScreen />, connection);
    await fireEvent.changeText(screen.getByLabelText('Title'), title);
    for (const name of ingredientNameList) {
      await fireEvent.press(screen.getByRole('button', { name: `Add ${name}` }));
    }
  };
  // A recipe saved with two quantities, as a phone would have saved them.
  const givenRecipeNeeds = (...[title = '', ...parts]: string[]) => {
    const [
      firstAmount = '',
      firstUnit = '',
      firstName = '',
      secondAmount = '',
      secondUnit = '',
      secondName = '',
    ] = parts;
    const first = findOrCreateIngredient(connection.db, firstName).id;
    const second = findOrCreateIngredient(connection.db, secondName).id;
    saveRecipe(connection.db, {
      ingredientIdList: [first, second],
      instructions: '',
      quantities: new Map([
        [first, { amount: Number(firstAmount), unit: firstUnit as Unit }],
        [second, { amount: Number(secondAmount), unit: secondUnit as Unit }],
      ]),
      season: 'both',
      title,
    });
  };
  const giveQuantity = async (name: string, amount: string) => {
    await fireEvent.changeText(screen.getByLabelText(`Quantity of ${name}`), amount);
  };
  const saveTheRecipe = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));
  };
  const showFirstRecipe = async () => {
    const [{ id } = { id: -1 }] = firstRecipePage(connection.db);
    await renderWithDatabase(<RecipeDetails recipe={getRecipe(connection.db, id)!} />, connection);
  };
  // The lines of the recipe's ingredient list, in order.
  const shownLines = () =>
    screen.getAllByText(/^• /).map((element) => element.props.children as string);

  test('Quantities are given in the recipe form', ({ and, given, then, when }) => {
    given(/^the ingredients "(.*)" exist$/, givenIngredients);
    and(/^I am writing the recipe "(.*)" with them$/, startRecipeWithThem);
    when(
      /^I give "(.*)" the quantity "(.*)" in "(.*)"$/,
      async (name: string, amount: string, unit: string) => {
        await giveQuantity(name, amount);
        await fireEvent.press(screen.getByRole('button', { name: `Unit of ${name}: pieces` }));
        await fireEvent.press(screen.getByRole('button', { name: unit }));
      },
    );
    and(/^I give "(.*)" the quantity "(.*)"$/, giveQuantity);
    and('I save the recipe', saveTheRecipe);
    then(/^the recipe lists "(.*)"$/, async (lines: string) => {
      await showFirstRecipe();

      expect(shownLines()).toStrictEqual(lines.split(', ').map((line) => `• ${line}`));
    });
  });

  test('A quantity must be a number', ({ and, given, then, when }) => {
    given(/^the ingredients "(.*)" exist$/, givenIngredients);
    and(/^I am writing the recipe "(.*)" with them$/, startRecipeWithThem);
    when(/^I give "(.*)" the quantity "(.*)"$/, giveQuantity);
    and('I save the recipe', saveTheRecipe);
    then('I am asked for a number like 1.5 or 1/2', () => {
      expect(screen.getByText('Enter a number, like 2, 1.5 or 1/2.')).toBeOnTheScreen();
    });
    and('no recipe is saved', () => {
      expect(firstRecipePage(connection.db)).toStrictEqual([]);
    });
  });

  test('A recipe written in US units is shown in my units', ({ given, then, when }) => {
    given(RECIPE_NEEDS, givenRecipeNeeds);
    // The recipe on screen re-renders with the new units.
    when('I read it with European units', async () => {
      await act(() => updatePreferences({ units: 'metric' }));
    });
    then(/^the recipe lists "(.*)"$/, async (lines: string) => {
      await showFirstRecipe();

      expect(shownLines()).toStrictEqual(lines.split(', ').map((line) => `• ${line}`));
    });
    when('I read it with US units', async () => {
      await act(() => updatePreferences({ units: 'us' }));
    });
    then(/^the recipe lists "(.*)"$/, async (lines: string) => {
      await showFirstRecipe();

      expect(shownLines()).toStrictEqual(lines.split(', ').map((line) => `• ${line}`));
    });
  });

  test('Saving a recipe without touching a quantity keeps it exact', ({ given, then, when }) => {
    given(RECIPE_NEEDS, givenRecipeNeeds);
    when('I edit it with European units and save it without changes', async () => {
      const [{ id } = { id: -1 }] = firstRecipePage(connection.db);
      jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(id) });
      await renderWithDatabase(<RecipeFormScreen />, connection);

      // Shown rounded: 8 oz = 226.8 g.
      expect(screen.getByLabelText('Quantity of Flour')).toHaveDisplayValue('227');

      await saveTheRecipe();
    });
    then(/^"(.*)" still weighs exactly 8 oz$/, (name: string) => {
      const [{ id } = { id: -1 }] = firstRecipePage(connection.db);

      expect(
        getRecipe(connection.db, id)?.ingredientList.find((ingredient) => ingredient.name === name)
          ?.quantity,
      ).toStrictEqual(toStored({ amount: 8, unit: 'oz' }));
    });
  });
});
