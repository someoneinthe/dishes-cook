import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { hide as hideSplashScreen } from 'expo-splash-screen';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { LoadingScreen } from './loading-screen';

jest.mock('expo-splash-screen', () => ({ hide: jest.fn() }));

const feature = loadFeature('./loading-screen.feature', { loadRelativePath: true });

defineFeature(feature, (test) => {
  let onFinish: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    onFinish = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const theAppIsStarting = async () => {
    await render(<LoadingScreen onFinish={onFinish} />);
  };

  const millisecondsHavePassed = async (milliseconds: string) => {
    await act(() => {
      jest.advanceTimersByTime(Number(milliseconds));
    });
  };

  const theLoadingScreenIsFinished = () => {
    expect(onFinish).toHaveBeenCalledTimes(1);
  };

  test('The illustration replaces the native splash screen', ({ given, then, when }) => {
    given('the app is starting', theAppIsStarting);
    when('the loading screen is laid out', async () => {
      await fireEvent(screen.getByTestId('loading-screen'), 'layout', {
        nativeEvent: { layout: { height: 800, width: 400, x: 0, y: 0 } },
      });
    });
    then('the native splash screen is hidden', () => {
      expect(hideSplashScreen).toHaveBeenCalledTimes(1);
    });
  });

  test('The app opens once the illustration has been shown', ({ and, given, then, when }) => {
    given('the app is starting', theAppIsStarting);
    and('the illustration is displayed', async () => {
      await fireEvent(screen.getByTestId('loading-screen-image'), 'display');
    });
    when(/^(\d+) milliseconds have passed$/, millisecondsHavePassed);
    then('the loading screen is finished', theLoadingScreenIsFinished);
  });

  test('The app still opens when the illustration fails to load', ({ and, given, then, when }) => {
    given('the app is starting', theAppIsStarting);
    and('the illustration fails to load', async () => {
      await fireEvent(screen.getByTestId('loading-screen-image'), 'error', {
        nativeEvent: { error: 'Failed to load the image' },
      });
    });
    when(/^(\d+) milliseconds have passed$/, millisecondsHavePassed);
    then('the loading screen is finished', theLoadingScreenIsFinished);
  });
});
