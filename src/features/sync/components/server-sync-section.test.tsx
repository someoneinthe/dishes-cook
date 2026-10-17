import { cleanup, fireEvent, screen } from '@testing-library/react-native';
import { createFakeSyncServer } from '@/test/fake-sync-server';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { disconnect } from '../sync-store';
import { ServerSyncSection } from './server-sync-section';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), setParams: jest.fn() },
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
}));

const ACCOUNT = { email: 'home@example.org', password: 'test-password' };
const INVALID_ADDRESS = 'Enter the server’s address, like recipes.example.org.';
const MISSING_ACCOUNT = 'Enter the email and password of your server account.';

describe('serverSyncSection', () => {
  let server: ReturnType<typeof createFakeSyncServer>;

  beforeEach(() => {
    server = createFakeSyncServer(ACCOUNT);
    jest.spyOn(globalThis, 'fetch').mockImplementation(server.fetch);
  });

  afterEach(async () => {
    // Unmounted first: disconnecting updates the section.
    await cleanup();
    await disconnect();
    jest.restoreAllMocks();
  });

  const openConnectForm = async () => {
    await renderWithDatabase(
      <ServerSyncSection isSyncNowFocused={false} />,
      createTestConnection(),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Synced with a server' }));
  };

  const connectWith = async (password: string) => {
    await fireEvent.changeText(screen.getByLabelText('Server address'), 'sync.example.org');
    await fireEvent.changeText(screen.getByLabelText('Email'), ACCOUNT.email);
    await fireEvent.changeText(screen.getByLabelText('Password'), password);
    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));
  };

  it('shows a wrong password under the password', async () => {
    await openConnectForm();

    await connectWith('wrong');

    await expect(screen.findByHintText('Wrong email or password.')).resolves.toHaveAccessibleName(
      'Password',
    );
  });

  it('shows a server that doesn’t answer under its address', async () => {
    server.setReachable(false);
    await openConnectForm();

    await connectWith(ACCOUNT.password);

    await expect(screen.findByHintText(/^The server doesn’t answer/)).resolves.toHaveAccessibleName(
      'Server address',
    );
  });

  it('shows a refusal no field is to blame for under the form', async () => {
    // Too many sign-ins in a minute (the server's rate limit).
    jest.mocked(fetch).mockResolvedValue(new Response('{}', { status: 429 }));
    await openConnectForm();

    await connectWith(ACCOUNT.password);

    await expect(screen.findByRole('alert')).resolves.toHaveTextContent(
      'The server refused the request. Try again later.',
    );
    expect(
      screen.queryByHintText('The server refused the request. Try again later.'),
    ).not.toBeOnTheScreen();
  });

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
