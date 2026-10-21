import { screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { spyOnAlert } from '@/test/alert';
import { pressInHeaderMenu } from '@/test/header-menu';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { getRecipe, saveRecipe } from './db/recipe-queries';
import { RecipeDetailScreen } from './recipe-detail-screen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useLocalSearchParams: jest.fn(),
}));

describe('recipeDetailScreen', () => {
  let connection: DatabaseConnection;
  let id: number;

  beforeEach(() => {
    connection = createTestConnection();
    const carrotId = findOrCreateIngredient(connection.db, 'Carrot').id;
    id = saveRecipe(connection.db, {
      ingredientIdList: [carrotId],
      instructions: 'Simmer for 30 minutes.',
      season: 'winter',
      title: 'Carrot soup',
    });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(id) });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('shows the recipe', async () => {
    await renderWithDatabase(<RecipeDetailScreen />, connection);

    expect(screen.getByRole('header', { name: 'Carrot soup' })).toBeOnTheScreen();
    expect(screen.getByText('Winter')).toBeOnTheScreen();
    expect(screen.getByText('• Carrot')).toBeOnTheScreen();
    expect(screen.getByText('Simmer for 30 minutes.')).toBeOnTheScreen();
  });

  it('opens the editor', async () => {
    await renderWithDatabase(<RecipeDetailScreen />, connection);

    await pressInHeaderMenu('Edit');

    expect(router.push).toHaveBeenCalledWith({
      params: { id: String(id) },
      pathname: '/recipe/[id]/edit',
    });
  });

  it('deletes the recipe after confirmation', async () => {
    const alert = spyOnAlert();
    await renderWithDatabase(<RecipeDetailScreen />, connection);

    await pressInHeaderMenu('Delete');
    await alert.press('Delete');

    expect(getRecipe(connection.db, id)).toBeUndefined();
    expect(router.back).toHaveBeenCalledTimes(1);
    // Still shown while the screen animates away.
    expect(screen.getByRole('header', { name: 'Carrot soup' })).toBeOnTheScreen();
  });
});
