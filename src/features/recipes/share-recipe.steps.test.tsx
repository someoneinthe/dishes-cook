import { Directory } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { useLocalSearchParams } from 'expo-router';
import { shareAsync } from 'expo-sharing';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { spyOnAlert } from '@/test/alert';
import { pressInHeaderMenu } from '@/test/header-menu';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { saveRecipe } from './db/recipe-queries';
import { RecipeDetailScreen } from './recipe-detail-screen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useLocalSearchParams: jest.fn(),
}));

const feature = loadFeature('./share-recipe.feature', { loadRelativePath: true });

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let alert: ReturnType<typeof spyOnAlert>;
  const idByTitle = new Map<string, number>();

  beforeEach(() => {
    jest.clearAllMocks();
    connection = createTestConnection();
    alert = spyOnAlert();
    idByTitle.clear();
  });

  const theRecipe = (title: string, count: string) => {
    const leekId = findOrCreateIngredient(connection.db, 'Leek').id;
    const quantities = new Map([[leekId, { amount: Number(count) }]]);
    const id = saveRecipe(connection.db, {
      ingredientIdList: [leekId],
      instructions: 'Simmer.',
      quantities,
      season: 'winter',
      title,
    });
    idByTitle.set(title, id);
  };
  const openTheRecipe = async (title: string) => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(idByTitle.get(title)) });
    await renderWithDatabase(<RecipeDetailScreen />, connection);
  };
  const shareIt = async () => {
    await pressInHeaderMenu('Share as PDF');
  };

  test('A recipe is shared as a PDF named after it', ({ and, given, then, when }) => {
    given(/^the recipe "(.*)" with (\d+) leeks$/, theRecipe);
    when(/^I open "(.*)"$/, openTheRecipe);
    and('I share it as a PDF', shareIt);
    then(/^a PDF of "(.*)" listing "(.*)" is shared$/, (title: string, line: string) => {
      const { html } = jest.mocked(printToFileAsync).mock.lastCall?.[0] ?? {};

      expect(html).toContain(`<h1>${title}</h1>`);
      expect(html).toContain(`<li>${line}</li>`);
      expect(shareAsync).toHaveBeenCalledWith(
        `file:///data/cache/shared-pdf/${title}.pdf`,
        expect.objectContaining({ mimeType: 'application/pdf' }),
      );
    });
    and('the PDF is deleted afterwards', () => {
      const deletedList = jest
        .mocked(Directory)
        .mock.results.filter(
          ({ value }) => (value as { delete: jest.Mock }).delete.mock.calls.length > 0,
        );

      expect(deletedList).toHaveLength(2);
    });
  });

  test("A PDF that can't be made is explained", ({ and, given, then, when }) => {
    given(/^the recipe "(.*)" with (\d+) leeks$/, theRecipe);
    and("PDFs can't be made", () => {
      jest.mocked(printToFileAsync).mockRejectedValueOnce(new Error('No WebView'));
    });
    when(/^I open "(.*)"$/, openTheRecipe);
    and('I share it as a PDF', shareIt);
    then("I'm told the PDF couldn't be made", () => {
      expect(alert.spy).toHaveBeenLastCalledWith(
        'The PDF couldn’t be made',
        'Try again. If it happens again, close the app and open it again.',
      );
      expect(shareAsync).not.toHaveBeenCalled();
    });
  });
});
