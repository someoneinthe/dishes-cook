import { screen } from '@testing-library/react-native';
import { eq } from 'drizzle-orm';
import { router, useLocalSearchParams } from 'expo-router';
import type { DatabaseConnection } from '@/db/types';
import type { SyncState } from '@/features/sync/sync-store';
import type { NavigationMock } from '@/test/navigation-mock';
import { accounts, recipes } from '@/db/schema';
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

// The sync server the phone is connected to (none by default).
const mockSync: { connection: SyncState['connection'] } = { connection: undefined };
jest.mock('../sync/sync-store', () => ({
  ...jest.requireActual<object>('../sync/sync-store'),
  useSyncState: () => ({
    connection: mockSync.connection,
    isAppUpdateAvailable: false,
    isSyncing: false,
  }),
}));

const MY_ACCOUNT_ID = 'a00000000000001';

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
    mockSync.connection = undefined;
  });

  describe('who added it', () => {
    const syncWithServer = () => {
      mockSync.connection = {
        accountId: MY_ACCOUNT_ID,
        email: 'me@example.org',
        serverUrl: 'https://sync.example.org',
      };
    };
    // Added by another account.
    const setOtherAuthor = () =>
      connection.db
        .update(recipes)
        .set({ createdBy: 'b00000000000002' })
        .where(eq(recipes.id, id))
        .run();

    it('shows nothing without a sync server', async () => {
      await renderWithDatabase(<RecipeDetailScreen />, connection);

      expect(screen.queryByText(/^Added by/)).not.toBeOnTheScreen();
    });

    it('names the account that added it', async () => {
      syncWithServer();
      connection.db.insert(accounts).values({ id: 'b00000000000002', name: 'Alice' }).run();
      setOtherAuthor();

      await renderWithDatabase(<RecipeDetailScreen />, connection);

      expect(screen.getByText('Added by Alice')).toBeOnTheScreen();
    });

    it('says "you" for a recipe not on the server yet', async () => {
      syncWithServer();

      await renderWithDatabase(<RecipeDetailScreen />, connection);

      expect(screen.getByText('Added by you')).toBeOnTheScreen();
    });

    it('says "someone else" for another account without a name', async () => {
      syncWithServer();
      setOtherAuthor();

      await renderWithDatabase(<RecipeDetailScreen />, connection);

      expect(screen.getByText('Added by someone else')).toBeOnTheScreen();
    });
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
