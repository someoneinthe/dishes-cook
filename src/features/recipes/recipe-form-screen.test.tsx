import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { DatabaseConnection } from '@/db/types';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { getRecipe, listRecipes, saveRecipe } from './db/recipe-queries';
import { RecipeFormScreen } from './recipe-form-screen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  Stack: { Screen: () => null },
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
    await fireEvent.changeText(screen.getByLabelText('Recipe'), 'Simmer.');
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    const [{ id: savedId } = { id: -1 }] = listRecipes(connection.db);

    expect(getRecipe(connection.db, savedId)).toStrictEqual({
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
    expect(listRecipes(connection.db)).toStrictEqual([]);
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
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(getRecipe(connection.db, id)).toMatchObject({ ingredientList: [], season: 'both' });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('tells when the recipe to edit no longer exists', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: '42' });
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByRole('header', { name: 'Recipe not found' })).toBeOnTheScreen();
  });
});
