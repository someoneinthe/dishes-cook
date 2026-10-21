import { fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { UnistylesRuntime } from 'react-native-unistyles';
import type { DatabaseConnection } from '@/db/types';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { spyOnAlert } from '@/test/alert';
import { iconColorIn } from '@/test/icons';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { saveRecipe } from './db/recipe-queries';
import { RecipesScreen } from './recipes-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useIsFocused: () => true }));

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

    const alert = spyOnAlert();
    await fireEvent.press(screen.getByRole('button', { name: 'New recipe' }));

    expect(alert.spy).toHaveBeenLastCalledWith(
      'New recipe',
      expect.stringContaining('fill it in from a file'),
      expect.anything(),
      { cancelable: true },
    );

    await alert.press('Write it');

    expect(router.push).toHaveBeenCalledWith({ params: { kind: 'dish' }, pathname: '/recipe/new' });
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

    // Screen readers announce the row's labels with its title.
    const row = screen.getByRole('button', {
      name: 'Carrot soup, Winter & summer, Starter, 1 ingredient',
    });

    expect(within(row).getByText('Winter & summer')).toBeOnTheScreen();
    expect(within(row).getByText('Starter')).toBeOnTheScreen();
    expect(within(row).getByText('1 ingredient')).toBeOnTheScreen();

    await fireEvent.press(row);

    expect(router.push).toHaveBeenCalledWith({
      params: { id: String(id) },
      pathname: '/recipe/[id]',
    });
  });

  it('searches the recipes by title, ignoring case and accents', async () => {
    for (const title of ['Crème brûlée', 'Carrot soup', 'Leek soup']) {
      saveRecipe(connection.db, { ingredientIdList: [], instructions: '', season: 'both', title });
    }
    await renderWithDatabase(<RecipesScreen />, connection);

    await fireEvent.changeText(screen.getByLabelText('Search recipes'), 'SOUP');

    expect(screen.getByText('Carrot soup')).toBeOnTheScreen();
    expect(screen.getByText('Leek soup')).toBeOnTheScreen();
    expect(screen.queryByText('Crème brûlée')).not.toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Search recipes'), 'creme');

    expect(screen.getByText('Crème brûlée')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Search recipes'), 'pizza');

    expect(screen.getByText('No recipe matches “pizza”.')).toBeOnTheScreen();
  });

  it('has no search field before the first recipe', async () => {
    await renderWithDatabase(<RecipesScreen />, connection);

    expect(screen.queryByLabelText('Search recipes')).not.toBeOnTheScreen();
  });

  it('shows the Filters button as an icon, its text read by screen readers', async () => {
    saveRecipe(connection.db, {
      ingredientIdList: [],
      instructions: '',
      season: 'both',
      title: 'Soup',
    });
    await renderWithDatabase(<RecipesScreen />, connection);

    expect(screen.getByRole('button', { name: 'Filters' })).toBeOnTheScreen();
    expect(screen.queryByText('Filters')).not.toBeOnTheScreen();
  });

  it('tells which filters the Filters button shows: a drink has only the ingredient one', async () => {
    saveRecipe(connection.db, {
      ingredientIdList: [],
      instructions: '',
      kind: 'drink',
      season: 'both',
      title: 'Mojito',
    });
    await renderWithDatabase(<RecipesScreen kind="drink" />, connection);

    expect(screen.getByHintText('Shows the ingredient filter')).toBe(
      screen.getByRole('button', { name: 'Filters' }),
    );
  });

  it('tints the Filters button while filters are on', async () => {
    saveRecipe(connection.db, {
      ingredientIdList: [],
      instructions: '',
      season: 'both',
      title: 'Soup',
    });
    await renderWithDatabase(<RecipesScreen />, connection);
    const filtersIconColor = () => iconColorIn(screen.getByRole('button', { name: /^Filters/ }));
    // The theme the tests render with.
    const { colors } = UnistylesRuntime.getTheme();

    expect(filtersIconColor()).toBe(colors.text);

    await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Winter' }));

    expect(filtersIconColor()).toBe(colors.onActionSoft);
  });
});
