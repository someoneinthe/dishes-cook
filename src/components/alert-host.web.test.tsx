import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AlertHost } from './alert-host.web';
import { Alert, closeAlert, getShownAlert } from './alert.web';

describe('the web dialogs', () => {
  afterEach(async () => {
    // Closes what a test left open.
    await act(() => {
      for (let shown = getShownAlert(); shown; shown = getShownAlert()) {
        closeAlert(shown.id);
      }
    });
  });

  it('shows a dialog with its title, message and an OK button by default', async () => {
    await render(<AlertHost />);

    await act(() => {
      Alert.alert('Saved', 'Your recipe is saved.');
    });

    expect(screen.getByText('Saved')).toBeOnTheScreen();
    expect(screen.getByText('Your recipe is saved.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));

    expect(screen.queryByText('Saved')).not.toBeOnTheScreen();
  });

  it('runs the button pressed, then shows the next dialog', async () => {
    const onDelete = jest.fn();
    await render(<AlertHost />);

    await act(() => {
      Alert.alert('Delete “Soup”?', undefined, [
        { style: 'cancel', text: 'Cancel' },
        { onPress: onDelete, style: 'destructive', text: 'Delete' },
      ]);
      Alert.alert('Next one');
    });

    expect(screen.queryByText('Next one')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Next one')).toBeOnTheScreen();
  });

  it('presses Cancel when closed with Escape, and closes a choice list without Cancel', async () => {
    const onCancel = jest.fn();
    const onChoose = jest.fn();
    await render(<AlertHost />);

    await act(() => {
      Alert.alert('New recipe', undefined, [
        { onPress: onCancel, style: 'cancel', text: 'Cancel' },
        { text: 'Write it' },
      ]);
    });
    // Escape (React Native Web's Modal calls onRequestClose).
    await fireEvent(screen.getByTestId('alert-dialog'), 'requestClose');

    expect(onCancel).toHaveBeenCalledTimes(1);

    await act(() => {
      Alert.alert('New recipe', undefined, [
        { onPress: onChoose, text: 'Write it' },
        { onPress: onChoose, text: 'Choose a file' },
        { onPress: onChoose, text: 'Take a photo' },
      ]);
    });
    // Escape (React Native Web's Modal calls onRequestClose).
    await fireEvent(screen.getByTestId('alert-dialog'), 'requestClose');

    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.queryByText('New recipe')).not.toBeOnTheScreen();
  });
});
