import type { NavigationMock } from './navigation-mock';
// expo-sqlite's key-value store is native: an in-memory one for tests.
jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      clear: () => store.clear(),
      getItemSync: (key: string) => store.get(key) ?? null,
      setItemSync: (key: string, value: string) => store.set(key, value),
    },
  };
});

// The phone's language is native: English by default, tests can change it (jest.mocked(useLocales)).
jest.mock('expo-localization', () => {
  const localeList = [{ languageCode: 'en', languageTag: 'en-US' }];
  return { getLocales: jest.fn(() => localeList), useLocales: jest.fn(() => localeList) };
});

// Screens set their header buttons with <Drawer.Screen options={{ headerRight }}>: render them.
jest.mock('expo-router/drawer', () => ({
  Drawer: {
    Screen: jest.requireActual<NavigationMock>('./navigation-mock').ScreenWithHeaderButtons,
  },
}));
