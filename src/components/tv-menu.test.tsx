import type { DrawerContentComponentProps } from 'expo-router/drawer';
import type * as ReactNative from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { tvMenu } from './tv-menu';

// The menu's scroll view, without the drawer's safe area: a plain scroll view.
jest.mock('expo-router/drawer', () => ({
  DrawerContentScrollView: jest.requireActual<typeof ReactNative>('react-native').ScrollView,
}));

// The drawer navigator's props, for three screens: the menu shows the ones with a title that
// aren't hidden.
function menuProps(navigate: jest.Mock) {
  const routeList = [
    { key: 'recipes-key', name: 'recipes', options: { title: 'Recipes' } },
    {
      key: 'ingredients-key',
      name: 'ingredients',
      options: { drawerItemStyle: { display: 'none' }, title: 'Ingredients' },
    },
    { key: 'index-key', name: 'index', options: { title: 'Meal choice' } },
  ];
  return {
    descriptors: Object.fromEntries(routeList.map(({ key, options }) => [key, { options }])),
    navigation: { navigate },
    state: { index: 2, routes: routeList.map(({ key, name }) => ({ key, name })) },
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
});
