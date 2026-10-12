import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { FADE_OUT_MS, LoadingScreen, MIN_DISPLAY_MS } from './loading-screen';

jest.mock('expo-splash-screen', () => ({ hide: jest.fn() }));

describe('loadingScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('keeps the native splash screen until the illustration is displayed', async () => {
    expect.hasAssertions();

    await render(<LoadingScreen onFinish={jest.fn()} />);

    expect(screen.getByRole('progressbar', { name: 'Loading Dishes Cook' })).toBeOnTheScreen();
    expect(SplashScreen.hide).not.toHaveBeenCalled();
  });

  it('hides the native splash screen, then fades out after the minimum display time', async () => {
    expect.hasAssertions();

    const onFinish = jest.fn();
    await render(<LoadingScreen onFinish={onFinish} />);

    await fireEvent(screen.getByTestId('loading-screen-image'), 'display');

    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();

    await act(() => {
      jest.advanceTimersByTime(MIN_DISPLAY_MS + FADE_OUT_MS + 100);
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
