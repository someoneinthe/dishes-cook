import type { Text } from '@infinitered/react-native-mlkit-text-recognition';
import type { ImagePickerResult } from 'expo-image-picker';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibraryAsync, requestCameraPermissionsAsync } from 'expo-image-picker';
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

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useLocalSearchParams: () => ({}),
}));

const feature = loadFeature('./recipe-from-photo.feature', { loadRelativePath: true });
const PHOTO_OF = /^I fill in a new recipe from a photo of "(.*)" listing "(.*)"$/;
const PHOTO_STEPS = 'Simmer for 30 minutes.';
const CHOSEN_PHOTO: ImagePickerResult = {
  assets: [{ height: 1600, uri: 'file:///recipe-page.jpg', width: 1200 }],
  canceled: false,
};

// What the text recognition reads on a page: the title in large print, then each line on its own.
function readPage(title: string, lineList: readonly string[]): Text {
  const toBlock = (text: string, height: number) => {
    const frame = { bottom: height, left: 0, right: 100, top: 0 };
    return {
      frame,
      lines: [{ elements: [], frame, recognizedLanguages: [], text }],
      recognizedLanguages: [],
      text,
    };
  };
  const blockList = [title, 'Ingredients', ...lineList, 'Method', PHOTO_STEPS].map((text, index) =>
    toBlock(text, index === 0 ? 40 : 20),
  );
  return { blocks: blockList, text: '' };
}

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let alert: ReturnType<typeof spyOnAlert>;

  beforeEach(() => {
    connection = createTestConnection();
    updatePreferences({ units: 'metric' });
    alert = spyOnAlert();
    jest.mocked(launchImageLibraryAsync).mockResolvedValue(CHOSEN_PHOTO);
  });

  const givenIngredients = (names: string) => {
    for (const name of names.split(', ')) {
      findOrCreateIngredient(connection.db, name);
    }
  };
  const openNewRecipe = async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);
  };
  const scanPhoto = async (page: Text) => {
    jest.mocked(recognizeText).mockResolvedValue(page);
    await fireEvent.press(screen.getByRole('button', { name: 'Fill in from a photo' }));
    await alert.press('Choose a photo');
    await waitFor(() => expect(recognizeText).toHaveBeenCalledWith(CHOSEN_PHOTO.assets?.[0]?.uri));
  };
  const fillInFromPhoto = async (page: Text) => {
    await openNewRecipe();
    await scanPhoto(page);
  };
  const fillInRecipe = async (title: string, lines: string) => {
    await fillInFromPhoto(readPage(title, lines.split(', ')));
    await screen.findByDisplayValue(title);
  };
  const saveTheRecipe = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));
  };
  const recipeLists = async (title: string, lines: string) => {
    const [recipe] = firstRecipePage(connection.db);

    expect(recipe?.title).toBe(title);

    await renderWithDatabase(
      <RecipeDetails recipe={getRecipe(connection.db, recipe?.id ?? -1)!} />,
      connection,
    );

    expect(
      screen.getAllByText(/^• /).map((element) => element.props.children as string),
    ).toStrictEqual(lines.split(', ').map((line) => `• ${line}`));
  };
  const ingredientsAre = (names: string) => {
    expect(firstIngredientPage(connection.db).map(({ name }) => name)).toStrictEqual(
      names ? names.split(', ') : [],
    );
  };

  test('A photo fills in a new recipe', ({ and, given, then, when }) => {
    given(/^the ingredients "(.*)" exist$/, givenIngredients);
    when(PHOTO_OF, fillInRecipe);
    and('I save the recipe', saveTheRecipe);
    then(/^the recipe "(.*)" lists "(.*)"$/, recipeLists);
    and(/^the ingredients are "(.*)"$/, ingredientsAre);
  });

  test('New ingredients are only created when the recipe is saved', ({ then, when }) => {
    when(PHOTO_OF, fillInRecipe);
    then('no ingredient exists yet', () => ingredientsAre(''));
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
    then(/^the recipe "(.*)" lists "(.*)"$/, recipeLists);
    and(/^the ingredients are "(.*)"$/, ingredientsAre);
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
    then(/^the recipe "(.*)" lists "(.*)"$/, recipeLists);
    and(/^the ingredients are "(.*)"$/, ingredientsAre);
  });

  test('What I typed before stays', ({ and, given, then, when }) => {
    given(
      /^I typed the title "(.*)" and the steps "(.*)"$/,
      async (title: string, steps: string) => {
        await openNewRecipe();
        await fireEvent.changeText(screen.getByLabelText('Title'), title);
        await fireEvent.changeText(screen.getByLabelText('Recipe text'), steps);
      },
    );
    when(
      /^I fill in the recipe from a photo of "(.*)" listing "(.*)"$/,
      async (title: string, lines: string) => {
        await scanPhoto(readPage(title, lines.split(', ')));
        await screen.findByText('leeks');
      },
    );
    then(/^the title is still "(.*)"$/, (title: string) => {
      expect(screen.getByLabelText('Title')).toHaveDisplayValue(title);
    });
    and(/^the steps read "(.*)" then the photo's steps$/, (steps: string) => {
      expect(screen.getByLabelText('Recipe text')).toHaveDisplayValue(`${steps}\n\n${PHOTO_STEPS}`);
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
      await openNewRecipe();
      await fireEvent.press(screen.getByRole('button', { name: 'Fill in from a photo' }));
      await alert.press('Take a photo');
    });
    then('I am told to allow the camera or to choose an existing photo', async () => {
      await waitFor(() =>
        expect(alert.spy).toHaveBeenLastCalledWith(
          'Read a recipe from a photo',
          'Allow the camera in the phone’s settings to take a photo, or choose an existing one.',
          expect.anything(),
        ),
      );
    });
  });

  test('A photo without text', ({ then, when }) => {
    when('I fill in a new recipe from a photo without text', async () => {
      await fillInFromPhoto({ blocks: [], text: '' });
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
});
