import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { DatabaseConnection } from '@/db/types';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { saveRecipe } from './db/recipe-queries';
import { RecipesScreen } from './recipes-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('recipesScreen', () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createTestConnection();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('invites to add the first recipe', async () => {
    await renderWithDatabase(<RecipesScreen />, connection);

    expect(screen.getByRole('header', { name: 'No recipes yet' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'New recipe' }));

    expect(router.push).toHaveBeenCalledWith('/recipe/new');
  });

  it('lists the recipes with their season, course and ingredient count, and opens one', async () => {
    const carrotId = findOrCreateIngredient(connection.db, 'carrot').id;
    const id = saveRecipe(connection.db, {
      course: 'starter',
      ingredientIdList: [carrotId],
      instructions: '',
      season: 'both',
      title: 'Carrot soup',
    });
    await renderWithDatabase(<RecipesScreen />, connection);

    expect(screen.getByText('Winter & summer')).toBeOnTheScreen();
    expect(screen.getByText('Starter')).toBeOnTheScreen();
    expect(screen.getByText('1 ingredient')).toBeOnTheScreen();

    // Screen readers announce the row's labels with its title.
    await fireEvent.press(
      screen.getByRole('button', { name: 'Carrot soup, Winter & summer, Starter' }),
    );

    expect(router.push).toHaveBeenCalledWith({
      params: { id: String(id) },
      pathname: '/recipe/[id]',
    });
  });
});
