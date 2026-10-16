import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { DatabaseConnection } from '@/db/types';
import { deleteRecipe, saveRecipe } from '@/features/recipes/db/recipe-queries';
import { spyOnAlert } from '@/test/alert';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { MealChoiceScreen } from './meal-choice-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useIsFocused: () => true }));

describe('mealChoiceScreen', () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createTestConnection();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('invites to add a recipe when there is none', async () => {
    await renderWithDatabase(<MealChoiceScreen />, connection);

    expect(screen.getByRole('header', { name: 'No recipes yet' })).toBeOnTheScreen();

    expect(screen.getByRole('button', { name: 'Suggest a recipe' })).toBeDisabled();

    const alert = spyOnAlert();
    await fireEvent.press(screen.getByRole('button', { name: 'Create a recipe' }));
    await alert.press('Write it');

    expect(router.push).toHaveBeenCalledWith('/recipe/new');
  });

  it('invites to ask again once the suggested main course is deleted', async () => {
    // The pick reads at a random offset among the recipes: 0 is the first one.
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const omeletteId = saveRecipe(connection.db, {
      course: 'main',
      ingredientIdList: [],
      instructions: '',
      season: 'both',
      title: 'Omelette',
    });
    saveRecipe(connection.db, {
      course: 'main',
      ingredientIdList: [],
      instructions: '',
      season: 'both',
      title: 'Soup',
    });
    await renderWithDatabase(<MealChoiceScreen />, connection);

    expect(screen.getByRole('header', { name: 'Omelette' })).toBeOnTheScreen();

    deleteRecipe(connection.db, omeletteId);

    await expect(
      screen.findByRole('header', { name: 'What shall we eat?' }),
    ).resolves.toBeOnTheScreen();
    expect(
      screen.getByText('Tap Suggest: chance picks the only matching recipe.'),
    ).toBeOnTheScreen();
  });
});
