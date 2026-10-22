import { act, cleanup, fireEvent, screen } from '@testing-library/react-native';
import { asc } from 'drizzle-orm';
import { router } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import { recipes } from '@/db/schema';
import { saveRecipe } from '@/features/recipes/db/recipe-queries';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { SyncStatusButton } from '@/features/sync/components/sync-status-button';
import { toDisplayName } from '@/lib/text';
import { spyOnAlert } from '@/test/alert';
import { createFakeSyncServer } from '@/test/fake-sync-server';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { SERVER_MIGRATION_LIST, SYNC_VERSION } from './server-version';
import { createSyncApi, signIn } from './sync-api';
import { INITIAL_CURSORS, synchronize } from './sync-engine';
import { connect, disconnect, getSyncState } from './sync-store';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), setParams: jest.fn() },
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
}));

const feature = loadFeature('./server-sync.feature', { loadRelativePath: true });

const ACCOUNT = { email: 'home@example.org', password: 'test-password' };
const SERVER_ADDRESS = 'sync.example.org';
const SERVER_URL = `https://${SERVER_ADDRESS}`;

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let server: ReturnType<typeof createFakeSyncServer>;

  beforeEach(() => {
    connection = createTestConnection();
    server = createFakeSyncServer(ACCOUNT);
    jest.spyOn(globalThis, 'fetch').mockImplementation(server.fetch);
  });

  afterEach(async () => {
    // Unmounted first: disconnecting updates the settings screen.
    await cleanup();
    await disconnect();
    jest.restoreAllMocks();
  });

  const theSettingsAreOpen = async () => {
    // With the sync status the header of the menu's other screens shows.
    await renderWithDatabase(
      <>
        <SyncStatusButton />
        <SettingsScreen />
      </>,
      connection,
    );
  };
  // In act: the header's count of waiting changes is refreshed after the write.
  const theRecipeOnThisPhone = async (title: string) => {
    await act(async () => {
      saveRecipe(connection.db, { ingredientIdList: [], instructions: '', season: 'both', title });
      await Promise.resolve();
    });
  };
  const thePhoneIsSyncedWithTheServer = async () => {
    await connect(connection, { ...ACCOUNT, serverUrl: SERVER_URL });
    await theSettingsAreOpen();
  };
  const connectWith = async (password: string) => {
    await fireEvent.press(screen.getByRole('radio', { name: 'Synced with a server' }));
    await fireEvent.changeText(screen.getByLabelText('Server address'), SERVER_ADDRESS);
    await fireEvent.changeText(screen.getByLabelText('Email'), ACCOUNT.email);
    await fireEvent.changeText(screen.getByLabelText('Password'), password);
    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));
  };
  const dataIsKeptOnThisPhoneOnly = async () => {
    await expect(
      screen.findByText('Your data is kept on this device only.'),
    ).resolves.toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'This device only' })).toBeChecked();
  };
  // The phone's recipe titles as shown (saved in lowercase).
  const phoneTitles = () =>
    connection.db
      .select({ title: recipes.title })
      .from(recipes)
      .orderBy(asc(recipes.sortKey))
      .all()
      .map(({ title }) => toDisplayName(title));

  test('Data is kept on the phone only at first', ({ given, then }) => {
    given('the settings are open', theSettingsAreOpen);
    then('my data is kept on this phone only', async () => {
      await dataIsKeptOnThisPhoneOnly();

      expect(getSyncState().connection).toBeUndefined();
    });
  });

  test("Connecting to a server merges its recipes with the phone's", ({
    and,
    given,
    then,
    when,
  }) => {
    given(/^the recipe "(.*)" on this phone$/, theRecipeOnThisPhone);
    and(/^the recipe "(.*)" on the server, from another phone$/, async (title: string) => {
      const otherPhone = createTestConnection();
      saveRecipe(otherPhone.db, { ingredientIdList: [], instructions: '', season: 'both', title });
      const { token } = await signIn({ ...ACCOUNT, fetch: server.fetch, serverUrl: SERVER_URL });
      await synchronize(
        otherPhone.db,
        createSyncApi({ fetch: server.fetch, serverUrl: SERVER_URL, token }),
        INITIAL_CURSORS,
      );
    });
    and('the settings are open', theSettingsAreOpen);
    when('I connect to the server with the right account', async () => {
      await connectWith(ACCOUNT.password);
    });
    then('I am told that the phone is synced with the server', async () => {
      await expect(
        screen.findByText(`Synced with ${SERVER_ADDRESS} as ${ACCOUNT.email}.`),
      ).resolves.toBeOnTheScreen();
      await expect(screen.findByText(/^Last sync: /)).resolves.toBeOnTheScreen();
    });
    and(/^the phone has the recipes "(.*)" and "(.*)"$/, (first: string, second: string) => {
      expect(phoneTitles()).toStrictEqual([first, second]);
    });
    and(/^the server has the recipe "(.*)"$/, (title: string) => {
      const titleList = [...server.collection('recipes').values()].map((row) => row.title);

      // The phone sends titles as it saves them: in lowercase.
      expect(titleList).toContain(title.toLowerCase());
    });
  });

  test('A wrong password is refused', ({ and, given, then, when }) => {
    given('the settings are open', theSettingsAreOpen);
    when('I connect to the server with a wrong password', async () => {
      await connectWith('wrong-password');
    });
    then('I am told that the email or password is wrong', async () => {
      await expect(screen.findByText('Wrong email or password.')).resolves.toBeOnTheScreen();
    });
    and('the phone is not synced with the server', () => {
      expect(getSyncState().connection).toBeUndefined();
    });
  });

  test('An unreachable server is reported', ({ and, given, then, when }) => {
    given('the phone is synced with the server', thePhoneIsSyncedWithTheServer);
    and("the server can't be reached", () => {
      server.setReachable(false);
    });
    when('I ask for a sync', async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
    });
    then("I am told that the server doesn't answer", async () => {
      await expect(screen.findByText(/^The server doesn’t answer\./)).resolves.toBeOnTheScreen();
    });
  });

  const requestSync = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
  };

  test('A server older than the app is reported', ({ and, given, then, when }) => {
    given('the phone is synced with the server', thePhoneIsSyncedWithTheServer);
    and('the server lacks the latest server update', () => {
      server.setServerInfo({
        migrations: SERVER_MIGRATION_LIST.slice(0, -1),
        minimumAppSyncVersion: SYNC_VERSION,
      });
    });
    and(/^the recipe "(.*)" on this phone$/, theRecipeOnThisPhone);
    when('I ask for a sync', requestSync);
    then('I am told that the server needs an update', async () => {
      await expect(
        screen.findByText(/^Your server is older than this app: update the server/),
      ).resolves.toBeOnTheScreen();
    });
    and(/^the server doesn't have the recipe "(.*)"$/, (title: string) => {
      const titleList = [...server.collection('recipes').values()].map((row) => row.title);

      expect(titleList).not.toContain(title);
    });
  });

  test('An app older than the server is asked to update', ({ and, given, then, when }) => {
    given('the phone is synced with the server', thePhoneIsSyncedWithTheServer);
    and('the server only accepts newer apps', () => {
      server.setServerInfo({
        migrations: [...SERVER_MIGRATION_LIST],
        minimumAppSyncVersion: SYNC_VERSION + 1,
      });
    });
    when('I ask for a sync', requestSync);
    then('I am told that the app needs an update', async () => {
      await expect(
        screen.findByText(/^This app is too old for your server: update the app/),
      ).resolves.toBeOnTheScreen();
    });
  });

  test('A server newer than the app is pointed out', ({ and, given, then, when }) => {
    given('the phone is synced with the server', thePhoneIsSyncedWithTheServer);
    and("the server has an update this app doesn't know", () => {
      server.setServerInfo({
        migrations: [...SERVER_MIGRATION_LIST, '9999999999-from-a-newer-app.js'],
        minimumAppSyncVersion: SYNC_VERSION,
      });
    });
    when('I ask for a sync', requestSync);
    then('I am told that an app update exists', async () => {
      await expect(
        screen.findByText(/^Your server has a newer version: update the app/),
      ).resolves.toBeOnTheScreen();
    });
    and('the phone is still synced', () => {
      expect(getSyncState().error).toBeUndefined();
      expect(screen.getByText(/^Last sync: /)).toBeOnTheScreen();
    });
  });

  test('Changes waiting for the server show in the header', ({ and, given, then, when }) => {
    given('the phone is synced with the server', thePhoneIsSyncedWithTheServer);
    and(/^the recipe "(.*)" on this phone$/, theRecipeOnThisPhone);
    then('the header shows 1 change to sync', async () => {
      await expect(
        screen.findByRole('button', { name: '1 change to sync' }),
      ).resolves.toBeOnTheScreen();
    });
    when('I ask for a sync', requestSync);
    then('the header shows nothing about the sync', async () => {
      await expect(screen.findByText(/^Last sync: /)).resolves.toBeOnTheScreen();

      expect(screen.queryByRole('button', { name: /to sync$|^Sync failed/ })).toBeNull();
    });
  });

  test('A failed sync shows in the header, which leads to the settings', ({
    and,
    given,
    then,
    when,
  }) => {
    given('the phone is synced with the server', thePhoneIsSyncedWithTheServer);
    and("the server can't be reached", () => {
      server.setReachable(false);
    });
    and(/^the recipe "(.*)" on this phone$/, theRecipeOnThisPhone);
    when('I ask for a sync', requestSync);
    then('the header shows that the sync failed with 1 change waiting', async () => {
      await expect(
        screen.findByRole('button', { name: 'Sync failed, 1 change waits on this device' }),
      ).resolves.toBeOnTheScreen();
    });
    when('I press the sync status in the header', async () => {
      await fireEvent.press(screen.getByRole('button', { name: /^Sync failed/ }));
    });
    then('the data storage settings open', () => {
      expect(router.navigate).toHaveBeenCalledWith({
        params: { section: 'sync' },
        pathname: '/settings',
      });
    });
  });

  test('Stopping the sync keeps the data', ({ and, given, then, when }) => {
    given(/^the recipe "(.*)" on this phone$/, theRecipeOnThisPhone);
    and('the phone is synced with the server', thePhoneIsSyncedWithTheServer);
    when('I stop syncing with the server', async () => {
      const alert = spyOnAlert();
      await fireEvent.press(screen.getByRole('radio', { name: 'This device only' }));
      await alert.press('Stop syncing');
    });
    then('my data is kept on this phone only', dataIsKeptOnThisPhoneOnly);
    and(/^the phone has the recipe "(.*)"$/, (title: string) => {
      expect(phoneTitles()).toStrictEqual([title]);
    });
  });
});
