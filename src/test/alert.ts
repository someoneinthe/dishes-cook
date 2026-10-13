import type { AlertButton } from 'react-native';
import { act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Spies on Alert.alert; `press` taps a button of the last alert shown.
export function spyOnAlert() {
  const alertSpy = jest.spyOn(Alert, 'alert');
  return {
    press: async (text: string) => {
      const buttonList: AlertButton[] = alertSpy.mock.lastCall?.[2] ?? [];
      const button = buttonList.find((candidate) => candidate.text === text);
      if (!button?.onPress) {
        throw new Error(`No "${text}" button in the alert`);
      }
      await act(() => button.onPress?.());
    },
    spy: alertSpy,
  };
}
