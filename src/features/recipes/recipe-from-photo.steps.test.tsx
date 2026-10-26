import type { Text } from '@infinitered/react-native-mlkit-text-recognition';
import type { DocumentPickerResult } from 'expo-document-picker';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { getDocumentAsync } from 'expo-document-picker';
import { Directory } from 'expo-file-system';
import { requestCameraPermissionsAsync } from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { updatePreferences } from '@/features/settings/preferences';
import { spyOnAlert } from '@/test/alert';
import { firstIngredientPage, firstRecipePage } from '@/test/queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { RecipeDetails } from './components/recipe-details';
import { getRecipe } from './db/recipe-queries';
import { RecipeFormScreen } from './recipe-form-screen';
import { RecipesScreen } from './recipes-screen';

// The form's route parameters: none, or the recipe a scan passed (useNewRecipe).
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useIsFocused: () => true,
  useLocalSearchParams: jest.fn(() => ({})),
}));

const feature = loadFeature('./recipe-from-photo.feature', { loadRelativePath: true });
const PHOTO_OF = /^I fill in a new recipe from a photo of "(.*)" listing "(.*)"$/;
const PHOTO_STEPS = 'Simmer for 30 minutes.';
// A photo chosen with Choose a file: the picker's copy in the app's cache.
const CHOSEN_PHOTO: DocumentPickerResult = {
  assets: [
    {
      lastModified: 0,
      mimeType: 'image/jpeg',
      name: 'recipe-page.jpg',
      uri: 'file:///data/cache/DocumentPicker/recipe-page.jpg',
    },
  ],
  canceled: false,
};

// What the text recognition reads on a page: the title in large print, then each line on its own.
function readPage(title: string, lineList: readonly string[]): Text {
  // One block per line, one under the other.
  const toBlock = (text: string, index: number) => {
    const height = index === 0 ? 40 : 20;
    const frame = { bottom: index * 60 + height, left: 0, right: 100, top: index * 60 };
    return {
      frame,
      lines: [{ elements: [], frame, recognizedLanguages: [], text }],
      recognizedLanguages: [],
      text,
    };
  };
  const blockList = [title, 'Ingredients', ...lineList, 'Method', PHOTO_STEPS].map((text, index) =>
    toBlock(text, index),
  );
  return { blocks: blockList, text: '' };
}

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let alert: ReturnType<typeof spyOnAlert>;

  beforeEach(() => {
    jest.mocked(router.push).mockClear();
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    connection = createTestConnection();
    updatePreferences({ units: 'metric' });
    alert = spyOnAlert();
    jest.mocked(getDocumentAsync).mockResolvedValue(CHOSEN_PHOTO);
    jest.mocked(Directory).mockClear();
  });

  const givenIngredients = (names: string) => {
    for (const name of names.split(', ')) {
      findOrCreateIngredient(connection.db, name);
    }
  };
  // Recipes › + : the question how to start the recipe.
  const startNewRecipe = async () => {
    await renderWithDatabase(<RecipesScreen />, connection);
    await fireEvent.press(screen.getByRole('button', { name: 'New recipe' }));
  };
  const choosePhoto = async (page: Text) => {
    jest.mocked(recognizeText).mockResolvedValue(page);
    await alert.press('Choose a file');
    await waitFor(() => expect(recognizeText).toHaveBeenCalledWith(CHOSEN_PHOTO.assets?.[0]?.uri));
  };
  // The form the read photo opens (router.push), with its parameters.
  const openReadForm = async () => {
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    const [target] = jest.mocked(router.push).mock.lastCall ?? [];
    const params = typeof target === 'object' ? target.params : undefined;
    const draft = typeof params?.draft === 'string' ? params.draft : '';
    jest.mocked(useLocalSearchParams).mockReturnValue({ draft });
    await renderWithDatabase(<RecipeFormScreen />, connection);
  };
  const fillInRecipe = async (title: string, lines: string) => {
    await startNewRecipe();
    await choosePhoto(readPage(title, lines.split(', ')));
    await openReadForm();
    await screen.findByDisplayValue(title);
  };
  const saveTheRecipe = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));
  };
  // The saved recipe as its screen shows it: title, then the lines of its ingredient list.
  const shownRecipe = async () => {
    const [recipe] = firstRecipePage(connection.db);
    await renderWithDatabase(
      <RecipeDetails recipe={getRecipe(connection.db, recipe?.id ?? -1)!} />,
      connection,
    );
    return {
      lineList: screen.getAllByText(/^• /).map((element) => element.props.children as string),
      title: recipe?.title,
    };
  };
  const expectedRecipe = (title: string, lines: string) => ({
    lineList: lines.split(', ').map((line) => `• ${line}`),
    title,
  });
  // How the file picker's folder in the app's cache, where it leaves its copy of the file, was
  // deleted (its `delete` mock), once the file was read.
  const pickedPhotoFolderDeletion = async () => {
    const folderOf = () =>
      jest
        .mocked(Directory)
        .mock.results.map(({ value }) => value as { delete: jest.Mock; name: string })
        .find(({ name }) => name === 'DocumentPicker');
    await waitFor(() => expect(folderOf()).toBeDefined());
    return folderOf()?.delete;
  };
  const ingredientNames = () => firstIngredientPage(connection.db).map(({ name }) => name);

  test('Adding a recipe asks how to start', ({ then, when }) => {
    when('I add a recipe from the recipe list', startNewRecipe);
    then('I am asked whether to write it, choose a file or take a photo', () => {
      const buttonList = alert.spy.mock.lastCall?.[2] ?? [];

      expect(buttonList.map(({ text }) => text)).toStrictEqual([
        'Write it',
        'Choose a file',
        'Take a photo',
      ]);
    });
    when(/^I choose a photo of "(.*)" listing "(.*)"$/, async (title: string, lines: string) => {
      await choosePhoto(readPage(title, lines.split(', ')));
    });
    then(
      /^the new recipe opens filled in with "(.*)" and "(.*)"$/,
      async (title: string, ingredient: string) => {
        await openReadForm();
        const [name = '', amount = ''] = ingredient.split(': ', 2);

        expect(screen.getByLabelText('Title')).toHaveDisplayValue(title);
        expect(screen.getByLabelText(`Quantity of ${name}`)).toHaveDisplayValue(amount);
        expect(screen.getByLabelText('Recipe text')).toHaveDisplayValue(PHOTO_STEPS);
      },
    );
  });

  test('A photo fills in a new recipe', ({ and, given, then, when }) => {
    given(/^the ingredients "(.*)" exist$/, givenIngredients);
    when(PHOTO_OF, fillInRecipe);
    then(/^the new ingredient "(.*)" is listed with a capital first letter$/, (name: string) => {
      expect(screen.getByRole('button', { name: `Remove ${name}` })).toBeOnTheScreen();
    });
    when('I save the recipe', saveTheRecipe);
    then(/^the recipe "(.*)" lists "(.*)"$/, async (title: string, lines: string) => {
      await expect(shownRecipe()).resolves.toStrictEqual(expectedRecipe(title, lines));
    });
    and(/^the ingredients are "(.*)"$/, (names: string) => {
      expect(ingredientNames()).toStrictEqual(names.split(', '));
    });
  });

  test('New ingredients are only created when the recipe is saved', ({ then, when }) => {
    when(PHOTO_OF, fillInRecipe);
    then('no ingredient exists yet', () => {
      expect(ingredientNames()).toStrictEqual([]);
    });
  });

  test('An ingredient like an existing one asks which to keep', ({ and, given, then, when }) => {
    given(/^the ingredients "(.*)" exist$/, givenIngredients);
    when(PHOTO_OF, fillInRecipe);
    then(/^I am told I already have "(.*)"$/, (name: string) => {
      expect(screen.getByText(`You already have “${name}”. Use it instead?`)).toBeOnTheScreen();
    });
    when('I save the recipe', saveTheRecipe);
    then('I am asked to choose before saving', () => {
      expect(screen.getByRole('alert')).toHaveTextContent(/choose one to save the recipe/);
    });
    and('no recipe is saved', () => {
      expect(firstRecipePage(connection.db)).toStrictEqual([]);
    });
    when(/^I use "(.*)"$/, async (name: string) => {
      await fireEvent.press(screen.getByRole('button', { name: `Use “${name}”` }));
    });
    and('I save the recipe', saveTheRecipe);
    then(/^the recipe "(.*)" lists "(.*)"$/, async (title: string, lines: string) => {
      await expect(shownRecipe()).resolves.toStrictEqual(expectedRecipe(title, lines));
    });
    and(/^the ingredients are "(.*)"$/, (names: string) => {
      expect(ingredientNames()).toStrictEqual(names.split(', '));
    });
  });

  test('A read name containing an existing ingredient asks too', ({ given, then, when }) => {
    given(/^the ingredients "(.*)" exist$/, givenIngredients);
    when(PHOTO_OF, fillInRecipe);
    then(/^I am told I already have "(.*)"$/, (name: string) => {
      expect(screen.getByText(`You already have “${name}”. Use it instead?`)).toBeOnTheScreen();
    });
  });

  test('The new ingredient can be kept', ({ and, given, then, when }) => {
    given(/^the ingredients "(.*)" exist$/, givenIngredients);
    when(PHOTO_OF, fillInRecipe);
    and(/^I keep the new "(.*)"$/, async (name: string) => {
      await fireEvent.press(
        screen.getByRole('button', { name: `Keep “${name}” as a new ingredient` }),
      );
    });
    and('I save the recipe', saveTheRecipe);
    then(/^the recipe "(.*)" lists "(.*)"$/, async (title: string, lines: string) => {
      await expect(shownRecipe()).resolves.toStrictEqual(expectedRecipe(title, lines));
    });
    and(/^the ingredients are "(.*)"$/, (names: string) => {
      expect(ingredientNames()).toStrictEqual(names.split(', '));
    });
  });

  test('The camera needs my permission', ({ given, then, when }) => {
    given('I refuse the camera', () => {
      jest.mocked(requestCameraPermissionsAsync).mockResolvedValueOnce({
        canAskAgain: false,
        expires: 'never',
        granted: false,
        status: 'denied' as never,
      });
    });
    when('I try to take a photo for a new recipe', async () => {
      await startNewRecipe();
      await alert.press('Take a photo');
    });
    then('I am told to allow the camera or to choose a file', async () => {
      await waitFor(() =>
        expect(alert.spy).toHaveBeenLastCalledWith(
          'Read a recipe from a photo',
          'Allow the camera in the phone’s settings to take a photo, or choose a file instead.',
          expect.anything(),
        ),
      );
    });
  });

  test('A photo without text', ({ then, when }) => {
    when('I fill in a new recipe from a photo without text', async () => {
      await startNewRecipe();
      await choosePhoto({ blocks: [], text: '' });
    });
    then('I am told that no recipe was found', async () => {
      await waitFor(() =>
        expect(alert.spy).toHaveBeenLastCalledWith(
          'No recipe found',
          expect.stringContaining('No text could be read'),
          expect.anything(),
        ),
      );
    });
  });

  test("The photo isn't kept", ({ then, when }) => {
    when(PHOTO_OF, fillInRecipe);
    then('the copies of the photo are deleted', async () => {
      await expect(pickedPhotoFolderDeletion()).resolves.toHaveBeenCalledTimes(1);
    });
  });

  test("The photo isn't kept when it can't be read", ({ and, then, when }) => {
    when("the photo I choose for a new recipe can't be read", async () => {
      jest.mocked(recognizeText).mockRejectedValueOnce(new Error('No text recognizer'));
      await startNewRecipe();
      await alert.press('Choose a file');
    });
    then("I am told that the photo couldn't be read", async () => {
      await waitFor(() =>
        expect(alert.spy).toHaveBeenLastCalledWith(
          // A short title (a long one is cut on Android), the details below it.
          'The file couldn’t be read',
          expect.stringContaining('protected by a password'),
          expect.anything(),
        ),
      );
    });
    and('the copies of the photo are deleted', async () => {
      await expect(pickedPhotoFolderDeletion()).resolves.toHaveBeenCalledTimes(1);
    });
  });
});
