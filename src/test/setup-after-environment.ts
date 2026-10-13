import type { NavigationMock } from './navigation-mock';
// Screens set their header buttons with <Drawer.Screen options={{ headerRight }}>: render them.
jest.mock('expo-router/drawer', () => ({
  Drawer: {
    Screen: jest.requireActual<NavigationMock>('./navigation-mock').ScreenWithHeaderButtons,
  },
}));
