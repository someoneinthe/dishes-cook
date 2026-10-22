import type { DrawerContentComponentProps } from 'expo-router/drawer';
import type * as ReactNative from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { tvMenu } from './tv-menu';

// The menu's scroll view, without the drawer's safe area: a plain scroll view.
jest.mock('expo-router/drawer', () => ({
  DrawerContentScrollView: jest.requireActual<typeof ReactNative>('react-native').ScrollView,
}));

// The drawer navigator's props, for three screens in the app's order (the meal choice first, where
// Back leads): the menu shows the ones with a title that aren't hidden. `shownIndex`: the screen
// shown. Like Expo Router's, a screen's route key is its name until it's first opened.
function menuProps(navigate: jest.Mock, shownIndex = 0) {
  const routeList = [
    { name: 'index', options: { title: 'Meal choice' } },
    { name: 'recipes', options: { title: 'Recipes' } },
    {
      name: 'ingredients',
      options: { drawerItemStyle: { display: 'none' }, title: 'Ingredients' },
    },
  ].map((route, index) => ({
    ...route,
    key: index === 0 || index === shownIndex ? `${route.name}:0-${index}` : route.name,
  }));
  return {
    descriptors: Object.fromEntries(routeList.map(({ key, options }) => [key, { options }])),
    navigation: { navigate },
    state: { index: shownIndex, routes: routeList.map(({ key, name }) => ({ key, name })) },
  } as unknown as DrawerContentComponentProps;
}

describe('tvMenu', () => {
  it('lists the visible entries, the current screen selected', async () => {
    const props = menuProps(jest.fn());
    await render(tvMenu(props));

    expect(screen.getByRole('button', { name: 'Recipes' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Meal choice' })).toBeSelected();
    expect(screen.queryByRole('button', { name: 'Ingredients' })).not.toBeOnTheScreen();
  });

  it('opens the screen of an entry', async () => {
    const navigate = jest.fn();
    const props = menuProps(navigate);
    await render(tvMenu(props));

    await fireEvent.press(screen.getByRole('button', { name: 'Recipes' }));

    expect(navigate).toHaveBeenCalledWith('recipes');
  });

  it('gives the focus back to the entry that opened a screen, once Back leaves it', async () => {
    const navigate = jest.fn();
    await render(tvMenu(menuProps(navigate)));

    const entry = screen.getByRole('button', { name: 'Recipes' });
    await fireEvent.press(entry);
    await screen.rerender(tvMenu(menuProps(navigate, 1)));

    // The same entry, though the screen's route got its key: a new one would lose the focus.
    expect(screen.getByRole('button', { name: 'Recipes' })).toBe(entry);
    expect(entry).toHaveProp('hasTVPreferredFocus', false);

    await screen.rerender(tvMenu(menuProps(navigate, 0)));

    expect(screen.getByRole('button', { name: 'Recipes' })).toHaveProp('hasTVPreferredFocus', true);
  });

  it('leaves the focus alone after a screen the menu didn’t open', async () => {
    const navigate = jest.fn();
    await render(tvMenu(menuProps(navigate)));

    // Opened by a button of the screen (e.g. the header's sync status), which takes the focus back.
    await screen.rerender(tvMenu(menuProps(navigate, 1)));
    await screen.rerender(tvMenu(menuProps(navigate, 0)));

    expect(screen.getByRole('button', { name: 'Recipes' })).toHaveProp(
      'hasTVPreferredFocus',
      false,
    );
  });
});
