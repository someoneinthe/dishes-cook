import { fireEvent, screen } from '@testing-library/react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { spyOnAlert } from '@/test/alert';
import { firstRecipePage } from '@/test/queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { getRecipe, saveRecipe } from './db/recipe-queries';
import { RecipeDetailScreen } from './recipe-detail-screen';
import { RecipeFormScreen } from './recipe-form-screen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useLocalSearchParams: jest.fn(),
}));

const feature = loadFeature('./recipe-photo-and-times.feature', { loadRelativePath: true });

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let alert: ReturnType<typeof spyOnAlert>;
  let recipeId: number | undefined;

  beforeEach(() => {
    connection = createTestConnection();
    alert = spyOnAlert();
    recipeId = undefined;
  });

  const startNewRecipe = async (title: string) => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await renderWithDatabase(<RecipeFormScreen />, connection);
    await fireEvent.changeText(screen.getByLabelText('Title'), title);
  };
  const saveTheRecipe = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));
  };
  const editIt = async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(recipeId) });
    await renderWithDatabase(<RecipeFormScreen />, connection);
  };
  // The photo: hidden from screen readers (the title next to it says what it shows).
  const openTheRecipe = async () => {
    recipeId ??= firstRecipePage(connection.db)[0]?.id;
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(recipeId) });
    await renderWithDatabase(<RecipeDetailScreen />, connection);
  };

  test('The times are written in the form and shown on the recipe', ({
    and,
    given,
    then,
    when,
  }) => {
    given(/^I am writing a new recipe "(.*)"$/, startNewRecipe);
    when(
      /^I give it (\d+) minutes of preparation and (\d+) of cooking$/,
      async (prep: string, cook: string) => {
        await fireEvent.changeText(screen.getByLabelText('Preparation (min)'), prep);
        await fireEvent.changeText(screen.getByLabelText('Cooking (min)'), cook);
      },
    );
    and('I save the recipe', saveTheRecipe);
    then(/^the recipe shows "(.*)"$/, async (times: string) => {
      await openTheRecipe();

      expect(screen.getByText(times)).toBeOnTheScreen();
    });
  });

  test("A time that isn't a number of minutes is refused", ({ and, given, then, when }) => {
    given(/^I am writing a new recipe "(.*)"$/, startNewRecipe);
    when(/^I give it "(.*)" of preparation$/, async (typed: string) => {
      await fireEvent.changeText(screen.getByLabelText('Preparation (min)'), typed);
    });
    and('I save the recipe', saveTheRecipe);
    then("I'm asked for a number of minutes", () => {
      expect(screen.getByText('Enter a number of minutes, like 20.')).toBeOnTheScreen();
    });
    and("the recipe isn't saved", () => {
      expect(firstRecipePage(connection.db)).toStrictEqual([]);
    });
  });

  test('A photo is added from the gallery, and removed after confirming', ({
    and,
    given,
    then,
    when,
  }) => {
    given(/^the recipe "(.*)" exists$/, (title: string) => {
      recipeId = saveRecipe(connection.db, {
        ingredientIdList: [],
        instructions: '',
        season: 'both',
        title,
      });
    });
    when('I edit it and add a photo from the gallery', async () => {
      jest.mocked(launchImageLibraryAsync).mockResolvedValueOnce({
        assets: [{ height: 3000, uri: 'file:///data/cache/ImagePicker/picked.jpg', width: 4000 }],
        canceled: false,
      });
      await editIt();
      await fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
      await alert.press('Choose a photo');

      await expect(
        screen.findByTestId('recipe-photo', { includeHiddenElements: true }),
      ).resolves.toBeOnTheScreen();
    });
    and('I save the recipe', saveTheRecipe);
    then('the recipe shows its photo', async () => {
      expect(getRecipe(connection.db, recipeId ?? 0)?.photoFile).toMatch(/^[\w-]+\.jpg$/);

      await openTheRecipe();

      expect(screen.getByTestId('recipe-photo', { includeHiddenElements: true })).toBeOnTheScreen();
    });
    when('I edit it and remove the photo', async () => {
      await editIt();
      await fireEvent.press(screen.getByRole('button', { name: 'Remove the photo' }));

      expect(alert.spy).toHaveBeenLastCalledWith(
        'Delete “this photo”?',
        'The recipe stays as it is.',
        expect.any(Array),
      );
    });
    and('I confirm the removal', async () => {
      await alert.press('Delete');
    });
    and('I save the recipe', saveTheRecipe);
    then('the recipe shows no photo', async () => {
      expect(getRecipe(connection.db, recipeId ?? 0)).not.toHaveProperty('photoFile');

      await openTheRecipe();

      expect(
        screen.queryByTestId('recipe-photo', { includeHiddenElements: true }),
      ).not.toBeOnTheScreen();
    });
  });
});
