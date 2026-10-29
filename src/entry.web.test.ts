import { openDatabaseAsync } from 'expo-sqlite';
import { loadRecipePhotos } from '@/features/recipes/recipe-photos.web';
import { removeBrowser, setBrowser } from '@/test/browser';

const mockStartApp = jest.fn();

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('./features/recipes/recipe-photos.web', () => ({ loadRecipePhotos: jest.fn() }));
// The app itself (expo-router's entry): recorded, not started.
jest.mock('./start-app', () => {
  mockStartApp();
  return {};
});

// A page: what it shows when the app can't start.
function fakePage() {
  const shown: { text?: string } = {};
  setBrowser({
    document: {
      body: {
        replaceChildren: (node: { textContent: string }) => {
          shown.text = node.textContent;
        },
      },
      createElement: () => ({ setAttribute: jest.fn(), style: {}, textContent: '' }),
    },
  });
  return shown;
}

describe('the web app’s start', () => {
  const storage = { persist: jest.fn(() => Promise.resolve(true)) };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(loadRecipePhotos).mockResolvedValue();
    jest
      .mocked(openDatabaseAsync)
      .mockResolvedValue({ closeAsync: () => Promise.resolve() } as never);
    Object.defineProperty(globalThis, 'crossOriginIsolated', { configurable: true, value: true });
  });

  afterEach(() => {
    removeBrowser();
    Reflect.deleteProperty(globalThis, 'crossOriginIsolated');
  });

  const start = async (language = 'en-US') => {
    setBrowser({ navigator: { language, storage } });
    // Each start in its own module registry, the app's included: waited for inside it.
    await jest.isolateModulesAsync(async () => {
      await import('./entry.web');
      await new Promise(setImmediate);
    });
  };

  it('starts the database’s worker and lists the photos before the app, and asks to keep the data', async () => {
    const shown = fakePage();

    await start();

    expect(openDatabaseAsync).toHaveBeenCalledWith('dishes-cook.db');
    expect(loadRecipePhotos).toHaveBeenCalledTimes(1);
    expect(storage.persist).toHaveBeenCalledTimes(1);
    expect(mockStartApp).toHaveBeenCalledTimes(1);
    expect(shown.text).toBeUndefined();
  });

  it('starts the app when the photos can’t be listed: the recipes show without them', async () => {
    fakePage();
    jest.mocked(loadRecipePhotos).mockRejectedValue(new Error('No folder'));

    await start();

    expect(mockStartApp).toHaveBeenCalledTimes(1);
  });

  it('says so, in the browser’s language, when the database can’t open', async () => {
    const shown = fakePage();
    jest.mocked(openDatabaseAsync).mockRejectedValue(new Error('No worker'));

    await start('fr-FR');

    expect(mockStartApp).not.toHaveBeenCalled();
    expect(shown.text).toContain('n’a pas pu ouvrir ses données');
  });

  it('says the browser can’t run it on a page that isn’t isolated, without opening anything', async () => {
    const shown = fakePage();
    Object.defineProperty(globalThis, 'crossOriginIsolated', { configurable: true, value: false });

    await start();

    expect(openDatabaseAsync).not.toHaveBeenCalled();
    expect(mockStartApp).not.toHaveBeenCalled();
    expect(shown.text).toContain('can’t run Dishes Cook here');
  });
});
