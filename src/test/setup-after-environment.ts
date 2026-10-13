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

// Screens set their header buttons with <Drawer.Screen options={{ headerRight }}>: render them.
jest.mock('expo-router/drawer', () => ({
  Drawer: {
    Screen: jest.requireActual<NavigationMock>('./navigation-mock').ScreenWithHeaderButtons,
  },
}));
