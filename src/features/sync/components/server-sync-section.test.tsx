import { cleanup, fireEvent, screen } from '@testing-library/react-native';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { ServerSyncSection } from './server-sync-section';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), setParams: jest.fn() },
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
}));

const INVALID_ADDRESS = 'Enter the server’s address, like recipes.example.org.';
const MISSING_ACCOUNT = 'Enter the email and password of your server account.';

describe('serverSyncSection', () => {
  afterEach(async () => {
    await cleanup();
  });

  const openConnectForm = async () => {
    await renderWithDatabase(
      <ServerSyncSection isSyncNowFocused={false} />,
      createTestConnection(),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Synced with a server' }));
  };

  it('shows an error under the field to fix, read with that field', async () => {
    await openConnectForm();

    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));

    expect(screen.getByHintText(INVALID_ADDRESS)).toHaveAccessibleName('Server address');

    await fireEvent.changeText(screen.getByLabelText('Server address'), 'sync.example.org');
    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));

    expect(screen.getByHintText(MISSING_ACCOUNT)).toHaveAccessibleName('Email');
  });

  it('clears an error when its field is edited, not when another one is', async () => {
    await openConnectForm();
    await fireEvent.changeText(screen.getByLabelText('Server address'), 'sync.example.org');
    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));

    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret');

    expect(screen.getByText(MISSING_ACCOUNT)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'home@example.org');

    expect(screen.queryByText(MISSING_ACCOUNT)).not.toBeOnTheScreen();
  });
});
