import type * as ReactModule from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type * as ButtonModule from './button';
import { Button } from './button';
import { HeaderActions } from './header-actions';

// The buttons, with where the ⋮ one is on screen (the test renderer's views can't measure), for the
// menu to open under it.
jest.mock('./button', () => {
  const { useImperativeHandle } = jest.requireActual<typeof ReactModule>('react');
  const actual = jest.requireActual<typeof ButtonModule>('./button');
  return {
    Button: ({ ref, ...props }: ReactModule.ComponentProps<typeof actual.Button>) => {
      useImperativeHandle(
        ref,
        () =>
          ({
            measureInWindow: (callback: (...frame: number[]) => void) => callback(700, 0, 48, 48),
          }) as never,
      );
      // Called, not rendered: JSX can't be used in a mock's factory.
      return actual.Button(props);
    },
  };
});

// The test window is 750 wide.
const layoutEvent = (width: number) => ({
  nativeEvent: { layout: { height: 48, width, x: 0, y: 0 } },
});

describe('headerActions', () => {
  const onEdit = jest.fn();
  const onShare = jest.fn();

  const renderActions = async (widths: Readonly<{ children: number; more: number }>) => {
    await render(
      <HeaderActions
        more={<Button icon="share-variant" isIconOnly label="Share" onPress={onShare} />}
      >
        <Button icon="pencil" isIconOnly label="Edit" onPress={onEdit} />
      </HeaderActions>,
    );
    await fireEvent(
      screen.getByTestId('measured-more', { includeHiddenElements: true }),
      'layout',
      layoutEvent(widths.more),
    );
    await fireEvent(
      screen.getByTestId('measured-children', { includeHiddenElements: true }),
      'layout',
      layoutEvent(widths.children),
    );
    await fireEvent(
      screen.getByTestId('measured-menuButton', { includeHiddenElements: true }),
      'layout',
      layoutEvent(48),
    );
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows every button when they fit', async () => {
    await renderActions({ children: 48, more: 48 });

    expect(screen.getByRole('button', { name: 'Share' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeOnTheScreen();
  });

  it('puts the other actions in a ⋮ menu when they do not fit, labeled, closed once pressed', async () => {
    await renderActions({ children: 48, more: 600 });

    expect(screen.getByRole('button', { name: 'Edit' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'More actions' }));
    await fireEvent.press(screen.getByText('Share'));

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Share')).not.toBeOnTheScreen();
  });

  it('puts every action in the menu when even the main ones do not fit', async () => {
    await renderActions({ children: 600, more: 48 });
    await fireEvent.press(screen.getByRole('button', { name: 'More actions' }));
    await fireEvent.press(screen.getByText('Edit'));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
