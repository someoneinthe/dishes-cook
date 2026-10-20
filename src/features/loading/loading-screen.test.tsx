import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { hide as hideSplashScreen } from 'expo-splash-screen';
import { FADE_OUT_MS, LoadingScreen, MIN_DISPLAY_MS } from './loading-screen';

jest.mock('expo-splash-screen', () => ({ hide: jest.fn() }));

const layoutEvent = { nativeEvent: { layout: { height: 800, width: 400, x: 0, y: 0 } } };

describe('loadingScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('hides the native splash screen as soon as it is laid out', async () => {
    expect.hasAssertions();

    await render(<LoadingScreen onFinish={jest.fn()} />);

    expect(hideSplashScreen).not.toHaveBeenCalled();

    await fireEvent(screen.getByTestId('loading-screen'), 'layout', layoutEvent);

    expect(screen.getByRole('progressbar', { name: 'Loading Dishes Cook' })).toBeOnTheScreen();
    expect(hideSplashScreen).toHaveBeenCalledTimes(1);
  });

  it('fades out after the minimum display time once the icon is displayed', async () => {
    expect.hasAssertions();

    const onFinish = jest.fn();
    await render(<LoadingScreen onFinish={onFinish} />);

    await fireEvent(screen.getByTestId('loading-screen-image'), 'display');

    await act(() => {
      jest.advanceTimersByTime(MIN_DISPLAY_MS - 1);
    });

    expect(onFinish).not.toHaveBeenCalled();

    await act(() => {
      jest.advanceTimersByTime(FADE_OUT_MS + 100);
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('still finishes when the icon fails to load', async () => {
    expect.hasAssertions();

    const onFinish = jest.fn();
    await render(<LoadingScreen onFinish={onFinish} />);

    await fireEvent(screen.getByTestId('loading-screen-image'), 'error', {
      nativeEvent: { error: 'Failed to load the image' },
    });
    await act(() => {
      jest.advanceTimersByTime(MIN_DISPLAY_MS + FADE_OUT_MS + 100);
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
