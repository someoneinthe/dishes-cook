import type { NavigationMock } from './navigation-mock';
// expo-sqlite's key-value store is native: an in-memory one for tests.
jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      clear: () => store.clear(),
      getItemSync: (key: string) => store.get(key) ?? null,
      removeItemSync: (key: string) => store.delete(key),
      setItemSync: (key: string, value: string) => store.set(key, value),
    },
  };
});

// expo-secure-store is native (Android Keystore): an in-memory one for tests.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    deleteItemAsync: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
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

// After an update, a FlatList (VirtualizedList) re-renders its cells on a 50 ms timer. When a test's
// last assertions outlasted it, the timer fired between the test and its cleanup, outside act
// ("An update to VirtualizedList … was not wrapped in act"). In tests the lists get no layout or
// scroll events, so that timer has nothing to render: it's pushed past any test, and the cleanup's
// unmount cancels it.
const { default: VirtualizedList } = jest.requireActual<{
  default: { defaultProps?: Record<string, unknown> };
}>('@react-native/virtualized-lists/Lists/VirtualizedList');
VirtualizedList.defaultProps = {
  ...VirtualizedList.defaultProps,
  // An hour: never during a test.
  updateCellsBatchingPeriod: 3_600_000,
};
