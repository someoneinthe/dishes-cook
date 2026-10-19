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
jest.mock('expo-file-system', () => {
  const uriOf = (partList: readonly (string | { uri: string })[]) =>
    partList
      .map((part) => (typeof part === 'string' ? part : part.uri))
      .join('/')
      .replaceAll(/([^/:])\/{2,}/g, '$1/');
  // `new File(folder, name)`, `new File(Paths.document, folder, name)` or `new File(uri)`; tests
  // read where files were moved (move.mock) and which were deleted (delete.mock).
  const File = jest.fn((...partList: (string | { uri: string })[]) => {
    const uri = uriOf(partList);
    return {
      base64: jest.fn(() => Promise.resolve('cGhvdG8=')),
      delete: jest.fn(),
      exists: true,
      move: jest.fn(() => Promise.resolve()),
      name: uri.split('/').at(-1) ?? '',
      uri,
    };
  });
  Object.assign(File, {
    downloadFileAsync: jest.fn((_url: string, destination: unknown) =>
      Promise.resolve(destination),
    ),
  });
  return {
    Directory: jest.fn((...partList: (string | { uri: string })[]) => ({
      create: jest.fn(),
      delete: jest.fn(),
      exists: true,
      list: jest.fn(() => []),
      name: uriOf(partList).split('/').at(-1) ?? '',
      uri: uriOf(partList),
    })),
    File,
    Paths: { cache: { uri: 'file:///data/cache/' }, document: { uri: 'file:///data/files/' } },
  };
});

// Resizing a picked photo: a JPEG "saved" in the manipulator's cache.
jest.mock('expo-image-manipulator', () => {
  const context = {
    renderAsync: jest.fn(() =>
      Promise.resolve({
        saveAsync: jest.fn(() =>
          Promise.resolve({
            height: 960,
            uri: 'file:///data/cache/ImageManipulator/resized.jpg',
            width: 1280,
          }),
        ),
      }),
    ),
    resize: jest.fn(),
  };
  return {
    ImageManipulator: { manipulate: jest.fn(() => context) },
    SaveFormat: { JPEG: 'jpeg' },
  };
});

// Making and sharing a PDF are native: a PDF "made" in the print cache, and a share sheet closed.
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(() =>
    Promise.resolve({ numberOfPages: 1, uri: 'file:///data/cache/Print/0f1e.pdf' }),
  ),
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(() => Promise.resolve()) }));
