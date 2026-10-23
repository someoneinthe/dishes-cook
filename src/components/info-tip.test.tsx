import { fireEvent, render, screen } from '@testing-library/react-native';
import { InfoTip } from './info-tip';

type MeasureInWindow = (callback: (...frame: number[]) => void) => void;

// The native methods every mocked View shares: they answer nothing by default.
const nativeMethods = jest.requireActual<{ default: { measureInWindow: MeasureInWindow } }>(
  '@react-native/jest-preset/jest/MockNativeMethods',
).default;

describe('infoTip', () => {
  beforeEach(() => {
    // The button, near the bottom of a phone.
    jest.mocked(nativeMethods.measureInWindow).mockImplementation((callback) => {
      callback(120, 700, 48, 48);
    });
  });

  afterEach(() => {
    jest.mocked(nativeMethods.measureInWindow).mockReset();
  });

  it('shows its explanation once pressed, until a tap anywhere', async () => {
    await render(<InfoTip label="About the meal history" message="Marked when cooked." />);

    expect(screen.queryByText('Marked when cooked.')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'About the meal history' }));

    expect(screen.getByText('Marked when cooked.')).toBeOnTheScreen();

    // Beside the bubble (a modal view): hidden from screen readers.
    await fireEvent.press(screen.getByTestId('info-tip-backdrop', { includeHiddenElements: true }));

    expect(screen.queryByText('Marked when cooked.')).not.toBeOnTheScreen();
  });
});
