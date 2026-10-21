import type { DrawerContentComponentProps } from 'expo-router/drawer';
import type * as React from 'react';
import type * as ReactNative from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { phoneMenu } from './phone-menu';

// The menu's scroll view, without the drawer's safe area: a plain scroll view; its entries, plain
// buttons named by their label.
jest.mock('expo-router/drawer', () => {
  const { createElement } = jest.requireActual<typeof React>('react');
  const { Pressable, ScrollView } = jest.requireActual<typeof ReactNative>('react-native');
  return {
    DrawerContentScrollView: ScrollView,
    DrawerItem: ({ label, onPress }: Readonly<{ label: string; onPress: () => void }>) =>
      createElement(Pressable, { accessibilityLabel: label, accessibilityRole: 'button', onPress }),
  };
});

// The drawer navigator's props, for the screens in the app's order, the meal choice shown.
// `isPressPrevented`: a listener prevents the press.
function menuProps(dispatch: jest.Mock, isPressPrevented = false) {
  const routeList = [
    { key: 'index-key', name: 'index', options: { title: 'Meal choice' } },
    { key: 'settings-key', name: 'settings', options: { title: 'Settings' } },
    { key: 'about-key', name: 'about', options: { title: 'About' } },
    { key: 'recipes-key', name: 'recipes', options: { title: 'Recipes' } },
  ];
  return {
    descriptors: Object.fromEntries(routeList.map(({ key, options }) => [key, { options }])),
    navigation: { dispatch, emit: () => ({ defaultPrevented: isPressPrevented }) },
    state: {
      index: 0,
      key: 'drawer-key',
      routes: routeList.map(({ key, name }) => ({ key, name })),
    },
  } as unknown as DrawerContentComponentProps;
}

describe('phoneMenu', () => {
  it('lists the entries, Settings and About last', async () => {
    const props = menuProps(jest.fn());
    await render(phoneMenu(props));

    const entryList = screen.getAllByRole('button');

    expect(entryList.map((entry) => entry.props.accessibilityLabel as unknown)).toStrictEqual([
      'Meal choice',
      'Recipes',
      'Settings',
      'About',
    ]);
  });

  it('opens the screen of an entry, and closes the menu on the screen shown', async () => {
    const dispatch = jest.fn();
    await render(phoneMenu(menuProps(dispatch)));

    await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Meal choice' }));

    const [[openAction], [closeAction]] = dispatch.mock.calls as [[unknown], [unknown]];

    expect(openAction).toMatchObject({ payload: { name: 'settings' }, target: 'drawer-key' });
    expect(closeAction).toMatchObject({ target: 'drawer-key', type: 'CLOSE_DRAWER' });
  });

  it('does nothing when a listener prevents the press', async () => {
    const dispatch = jest.fn();
    await render(phoneMenu(menuProps(dispatch, true)));

    await fireEvent.press(screen.getByRole('button', { name: 'About' }));

    expect(dispatch).not.toHaveBeenCalled();
  });
});
