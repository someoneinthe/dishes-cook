import { cleanup, fireEvent, screen } from '@testing-library/react-native';
import { asc } from 'drizzle-orm';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import { recipes } from '@/db/schema';
import { saveRecipe } from '@/features/recipes/db/recipe-queries';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { spyOnAlert } from '@/test/alert';
import { createFakeSyncServer } from '@/test/fake-sync-server';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { createSyncApi, signIn } from './sync-api';
import { INITIAL_CURSORS, synchronize } from './sync-engine';
import { connect, disconnect, getSyncState } from './sync-store';

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
    await renderWithDatabase(<SettingsScreen />, connection);
  };
  const theRecipeOnThisPhone = (title: string) => {
    saveRecipe(connection.db, { ingredientIdList: [], instructions: '', season: 'both', title });
  };
  const thePhoneIsSyncedWithTheServer = async () => {
    await connect(connection.db, { ...ACCOUNT, serverUrl: SERVER_URL });
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
      screen.findByText('Your data is kept on this phone only.'),
    ).resolves.toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'This phone only' })).toBeChecked();
  };
  const phoneTitles = () =>
    connection.db
      .select({ title: recipes.title })
      .from(recipes)
      .orderBy(asc(recipes.sortKey))
      .all()
      .map(({ title }) => title);

  test('Data is kept on the phone only at first', ({ given, then }) => {
    given('the settings are open', theSettingsAreOpen);
    then('my data is kept on this phone only', dataIsKeptOnThisPhoneOnly);
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
      const token = await signIn({ ...ACCOUNT, fetch: server.fetch, serverUrl: SERVER_URL });
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

      expect(titleList).toContain(title);
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

  test('Stopping the sync keeps the data', ({ and, given, then, when }) => {
    given(/^the recipe "(.*)" on this phone$/, theRecipeOnThisPhone);
    and('the phone is synced with the server', thePhoneIsSyncedWithTheServer);
    when('I stop syncing with the server', async () => {
      const alert = spyOnAlert();
      await fireEvent.press(screen.getByRole('radio', { name: 'This phone only' }));
      await alert.press('Stop syncing');
    });
    then('my data is kept on this phone only', dataIsKeptOnThisPhoneOnly);
    and(/^the phone has the recipe "(.*)"$/, (title: string) => {
      expect(phoneTitles()).toStrictEqual([title]);
    });
  });
});
