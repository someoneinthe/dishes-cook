import { fireEvent, screen } from '@testing-library/react-native';

type MeasureInWindow = (callback: (...frame: number[]) => void) => void;

// The native methods every mocked View shares: they answer nothing by default.
const nativeMethods = jest.requireActual<{ default: { measureInWindow: MeasureInWindow } }>(
  '@react-native/jest-preset/jest/MockNativeMethods',
).default;

// Opens the header's ⋮ menu (a recipe's page puts all its actions there).
export async function openHeaderMenu() {
  // The menu opens under its button, once measured: at the top right of a phone.
  jest.mocked(nativeMethods.measureInWindow).mockImplementation((callback) => {
    callback(340, 0, 48, 48);
  });
  await fireEvent.press(screen.getByRole('button', { name: 'More actions' }));
}

// Presses a button of the header's ⋮ menu.
export async function pressInHeaderMenu(name: string) {
  await openHeaderMenu();
  await fireEvent.press(screen.getByRole('button', { name }));
}
