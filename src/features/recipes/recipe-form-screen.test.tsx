import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { toStored } from '@/lib/units';
import { firstRecipePage } from '@/test/queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { getRecipe, saveRecipe } from './db/recipe-queries';
import { RecipeFormScreen } from './recipe-form-screen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));

describe('recipeFormScreen', () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createTestConnection();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a recipe with an existing and a new ingredient', async () => {
    const carrot = findOrCreateIngredient(connection.db, 'Carrot');
    await renderWithDatabase(<RecipeFormScreen />, connection);

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Carrot soup');
    await fireEvent.press(screen.getByRole('radio', { name: 'Winter' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add Carrot' }));
    await fireEvent.changeText(screen.getByLabelText('Search ingredients'), 'Ginger');
    await fireEvent.press(screen.getByRole('button', { name: 'Create Ginger' }));
    await fireEvent.changeText(screen.getByLabelText('Recipe text'), 'Simmer.');
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    const [{ id: savedId } = { id: -1 }] = firstRecipePage(connection.db);

    expect(getRecipe(connection.db, savedId)).toStrictEqual({
      // Main course unless chosen otherwise.
      course: 'main',
      id: savedId,
      ingredientList: [
        { id: carrot.id, name: 'Carrot' },
        { id: expect.any(Number) as number, name: 'Ginger' },
      ],
      instructions: 'Simmer.',
      season: 'winter',
      title: 'Carrot soup',
    });
    expect(router.replace).toHaveBeenCalledWith({
      params: { id: String(savedId) },
      pathname: '/recipe/[id]',
    });
  });

  it('requires a title', async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);

    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(screen.getByText('Give the recipe a title.')).toBeOnTheScreen();
    expect(firstRecipePage(connection.db)).toStrictEqual([]);
  });

  it('explains that the recipe can be written in Markdown', async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByText(/^Format it with Markdown: # Heading, \*\*bold\*\*/)).toBeOnTheScreen();
  });

  it('has nothing to preview while the recipe is empty', async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);

    await fireEvent.press(screen.getByRole('radio', { name: 'Preview' }));

    expect(screen.getByText('Nothing to preview yet.')).toBeOnTheScreen();
  });

  it('edits an existing recipe', async () => {
    const carrot = findOrCreateIngredient(connection.db, 'Carrot');
    const id = saveRecipe(connection.db, {
      ingredientIdList: [carrot.id],
      instructions: 'Simmer.',
      season: 'winter',
      title: 'Carrot soup',
    });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(id) });
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByLabelText('Title')).toHaveDisplayValue('Carrot soup');

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Carrot' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Both' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Dessert' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(getRecipe(connection.db, id)).toMatchObject({
      course: 'dessert',
      ingredientList: [],
      season: 'both',
    });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('requires a course: main course for a new recipe, the saved one when editing', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByRole('radio', { name: 'Main course' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: 'None' })).not.toBeOnTheScreen();

    await screen.unmount();
    const id = saveRecipe(connection.db, {
      course: 'starter',
      ingredientIdList: [],
      instructions: '',
      season: 'summer',
      title: 'Tomato salad',
    });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(id) });
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByRole('radio', { name: 'Starter' })).toBeChecked();
  });

  it('keeps the exact quantity of a row left as shown, and saves an edited row as typed', async () => {
    const flour = findOrCreateIngredient(connection.db, 'Flour').id;
    const milk = findOrCreateIngredient(connection.db, 'Milk').id;
    const id = saveRecipe(connection.db, {
      ingredientIdList: [flour, milk],
      instructions: '',
      quantities: new Map([
        [flour, { amount: 8, unit: 'oz' }],
        [milk, { amount: 1, unit: 'cup' }],
      ]),
      season: 'both',
      title: 'Cake',
    });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(id) });
    await renderWithDatabase(<RecipeFormScreen />, connection);

    // Shown rounded in European units: 8 oz = 226.8 g, 1 cup = 236.6 ml.
    expect(screen.getByLabelText('Quantity of Flour')).toHaveDisplayValue('227');
    expect(screen.getByLabelText('Quantity of Milk')).toHaveDisplayValue('237');

    await fireEvent.changeText(screen.getByLabelText('Quantity of Milk'), '250');
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(
      getRecipe(connection.db, id)?.ingredientList.map(({ quantity }) => quantity),
    ).toStrictEqual([toStored({ amount: 8, unit: 'oz' }), { amount: 250, unit: 'ml' }]);
  });

  it('tells when the recipe to edit no longer exists', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: '42' });
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByRole('header', { name: 'Recipe not found' })).toBeOnTheScreen();
  });
});
