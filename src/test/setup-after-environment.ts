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

// The library's own mock: insets of 0, without the SafeAreaProvider the app's root gives.
jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

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

// Text recognition (ML Kit) and the photo picker are native: tests choose what they return
// (jest.mocked(recognizeText), jest.mocked(launchImageLibraryAsync)…). By default, the user cancels.
jest.mock('@infinitered/react-native-mlkit-text-recognition', () => ({
  recognizeText: jest.fn(() => Promise.resolve({ blocks: [], text: '' })),
}));
jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(() => Promise.resolve({ assets: null, canceled: true })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ assets: null, canceled: true })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
}));

// The app's files are native (expo-file-system): every folder exists, tests check which ones were
// deleted (jest.mocked(Directory).mock.results).
jest.mock('expo-file-system', () => ({
  Directory: jest.fn((_parent: unknown, name: string) => ({
    create: jest.fn(),
    delete: jest.fn(),
    exists: true,
    name,
    uri: ['file:///data/cache', name].join('/'),
  })),
  // `new File(folder, name)` or `new File(uri)`; tests read where files were moved (move.mock).
  File: jest.fn((parent: string | { uri: string }, name?: string) => ({
    move: jest.fn(() => Promise.resolve()),
    uri: typeof parent === 'string' ? parent : [parent.uri, name].join('/'),
  })),
  Paths: { cache: { uri: 'file:///data/cache/' } },
}));

// Making and sharing a PDF are native: a PDF "made" in the print cache, and a share sheet closed.
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(() =>
    Promise.resolve({ numberOfPages: 1, uri: 'file:///data/cache/Print/0f1e.pdf' }),
  ),
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(() => Promise.resolve()) }));
