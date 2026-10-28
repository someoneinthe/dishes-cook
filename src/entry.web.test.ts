import { openDatabaseAsync } from 'expo-sqlite';
import { removeBrowser, setBrowser } from '@/test/browser';

const mockStartApp = jest.fn();

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('./features/recipes/recipe-photos.web', () => ({
  loadRecipePhotos: jest.fn(() => Promise.resolve()),
}));
// The app itself (expo-router's entry): recorded, not started.
jest.mock('./start-app', () => {
  mockStartApp();
  return {};
});

describe('the web app’s start', () => {
  afterEach(() => {
    removeBrowser();
  });

  it('starts the database’s worker and lists the photos before the app, and asks to keep the data', async () => {
    const closeAsync = jest.fn(() => Promise.resolve());
    jest.mocked(openDatabaseAsync).mockResolvedValue({ closeAsync } as never);
    const storage = { persist: jest.fn(() => Promise.resolve(true)) };
    setBrowser({ navigator: { storage } });

    await jest.isolateModulesAsync(async () => {
      await import('./entry.web');
    });
    await new Promise(setImmediate);

    expect(openDatabaseAsync).toHaveBeenCalledWith('dishes-cook.db');
    expect(closeAsync).toHaveBeenCalledTimes(1);
    expect(storage.persist).toHaveBeenCalledTimes(1);
    expect(mockStartApp).toHaveBeenCalledTimes(1);
  });
});
