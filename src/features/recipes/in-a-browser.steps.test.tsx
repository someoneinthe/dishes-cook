import { fireEvent, render, screen } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { Button } from '@/components/button';
import { AboutScreen } from '@/features/about/about-screen';
import { ServerSyncSection } from '@/features/sync/components/server-sync-section';
import { spyOnAlert } from '@/test/alert';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { RecipePhotoField } from './components/recipe-photo-field';
import { useNewRecipe } from './hooks/use-new-recipe';

// The app as a browser runs it.
jest.mock('../../lib/device', () => ({ isTv: false, isWeb: true }));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const feature = loadFeature('./in-a-browser.feature', { loadRelativePath: true });

// The button that starts a new recipe (the recipe list's +).
function NewRecipeButton() {
  const { start } = useNewRecipe();
  return <Button label="New recipe" onPress={start} />;
}

defineFeature(feature, (test) => {
  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'location');
  });

  test('A new recipe is written or read from a file, without a camera', ({ and, then, when }) => {
    let alert: ReturnType<typeof spyOnAlert>;
    when('I start a new recipe in a browser', async () => {
      alert = spyOnAlert();
      await render(<NewRecipeButton />);
      await fireEvent.press(screen.getByRole('button', { name: 'New recipe' }));
    });
    then('I can write it or choose a file, not take a photo', () => {
      expect(alert.spy.mock.lastCall?.[2]?.map(({ text }) => text)).toStrictEqual([
        'Write it',
        'Choose a file',
      ]);
    });
    and('I am told the file is read in the browser', () => {
      expect(alert.spy.mock.lastCall?.[1]).toContain('it’s read in your browser');
    });
  });

  test("A recipe's photo is chosen among the computer's files right away", ({ then, when }) => {
    let alert: ReturnType<typeof spyOnAlert>;
    when('I add a photo to a recipe in a browser', async () => {
      alert = spyOnAlert();
      await render(<RecipePhotoField onChange={jest.fn()} title="Pumpkin soup" />);
      await fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
    });
    then('the file picker opens, without asking where the photo comes from', () => {
      expect(launchImageLibraryAsync).toHaveBeenCalledTimes(1);
      expect(alert.spy).not.toHaveBeenCalled();
    });
  });

  test('The About page says where the browser keeps the data', ({ and, then, when }) => {
    when('I open the About page in a browser', async () => {
      await render(<AboutScreen />);
    });
    then('I am told my data is saved in this browser, which can clear it', () => {
      expect(screen.getByText(/saved in this browser/)).toBeOnTheScreen();
      expect(screen.getByText(/clearing this site’s data/)).toBeOnTheScreen();
    });
    and("I am told the sign-in token stays in this site's storage", () => {
      expect(screen.getByText(/it stays in this site’s storage/)).toBeOnTheScreen();
    });
  });

  test("The sync server's address is the web app's", ({ then, when }) => {
    when(/^I set up the sync in a browser opened on "(.*)"$/, async (origin: string) => {
      // Jest runs on Node, which has no page address.
      Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin } });
      await renderWithDatabase(
        <ServerSyncSection isSyncNowFocused={false} />,
        createTestConnection(),
      );
      await fireEvent.press(screen.getByRole('radio', { name: 'Synced with a server' }));
    });
    then(/^the server address is "(.*)"$/, (address: string) => {
      expect(screen.getByLabelText('Server address')).toHaveDisplayValue(address);
    });
  });
});
