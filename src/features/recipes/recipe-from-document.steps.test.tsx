import type { Text } from '@infinitered/react-native-mlkit-text-recognition';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { updatePreferences } from '@/features/settings/preferences';
import { renderPdfPages } from '@/lib/pdf-pages';
import { spyOnAlert } from '@/test/alert';
import { openDocument, wordDocument } from '@/test/documents';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
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

const feature = loadFeature('./recipe-from-document.feature', { loadRelativePath: true });
const PDF_FOLDER = 'file:///data/cache/pdf-pages/1';
// The text recognition's line heights: a title in large print, the rest as body text.
const TITLE_HEIGHT = 40;
const BODY_HEIGHT = 20;

// What the text recognition reads on a page: each line in a block of its own, one under the other.
function readPage(lineList: readonly Readonly<{ height: number; text: string }>[]): Text {
  const blockList = lineList.map(({ height, text }, index) => {
    const frame = { bottom: index * 60 + height, left: 0, right: 100, top: index * 60 };
    return {
      frame,
      lines: [{ elements: [], frame, recognizedLanguages: [], text }],
      recognizedLanguages: [],
      text,
    };
  });
  return { blocks: blockList, text: '' };
}

const body = (text: string) => ({ height: BODY_HEIGHT, text });

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let alert: ReturnType<typeof spyOnAlert>;
  const fileImplementation = jest.mocked(File).getMockImplementation();

  beforeEach(() => {
    jest.mocked(router.push).mockClear();
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    jest.mocked(recognizeText).mockClear();
    jest.mocked(Directory).mockClear();
    connection = createTestConnection();
    updatePreferences({ units: 'metric' });
    alert = spyOnAlert();
  });

  afterEach(() => {
    if (fileImplementation) {
      jest.mocked(File).mockImplementation(fileImplementation);
    }
  });

  // Recipes › + › Choose a file, picking this file (the picker's copy in the app's cache).
  const chooseFile = async (name: string, mimeType: string) => {
    const asset: DocumentPickerAsset = {
      lastModified: 0,
      mimeType,
      name,
      uri: `file:///data/cache/DocumentPicker/${name}`,
    };
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({ assets: [asset], canceled: false });
    await renderWithDatabase(<RecipesScreen />, connection);
    await fireEvent.press(screen.getByRole('button', { name: 'New recipe' }));
    await alert.press('Choose a file');
  };
  // The chosen file's content, as expo-file-system reads it.
  const givenFileContent = (content: Readonly<{ bytes?: Uint8Array; text?: string }>) => {
    jest.mocked(File).mockImplementation(
      (...partList) =>
        // The setup's mock file (src/test/setup-after-environment.ts), reading this content.
        ({
          ...fileImplementation?.(...partList),
          bytes: jest.fn(() => Promise.resolve(content.bytes ?? new Uint8Array())),
          text: jest.fn(() => Promise.resolve(content.text ?? '')),
        }) as unknown as File,
    );
  };
  // A PDF of `pageCount` pages, whose first ones (at most 5) are drawn and read as `pageList`.
  const givenPdf = (pageCount: number, pageList: readonly Text[]) => {
    const pageUriList = pageList.map((_, index) => `${PDF_FOLDER}/page-${index + 1}.jpg`);
    jest.mocked(renderPdfPages).mockResolvedValueOnce({
      folderUri: PDF_FOLDER,
      pageCount,
      pageUriList,
    });
    jest
      .mocked(recognizeText)
      .mockImplementation((uri) =>
        Promise.resolve(pageList[pageUriList.indexOf(uri)] ?? { blocks: [], text: '' }),
      );
  };
  // The form the read file opens (router.push), with its parameters.
  const openReadForm = async () => {
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    const [target] = jest.mocked(router.push).mock.lastCall ?? [];
    const params = typeof target === 'object' ? target.params : undefined;
    const scanned = typeof params?.scanned === 'string' ? params.scanned : '';
    jest.mocked(useLocalSearchParams).mockReturnValue({ scanned });
    await renderWithDatabase(<RecipeFormScreen />, connection);
  };
  const expectFilledIn = async (title: string, ingredient: string, steps: string) => {
    await openReadForm();
    const [name = '', amount = ''] = ingredient.split(': ', 2);

    expect(screen.getByLabelText('Title')).toHaveDisplayValue(title);
    expect(screen.getByLabelText(`Quantity of ${name}`)).toHaveDisplayValue(amount);
    expect(screen.getByLabelText('Recipe text')).toHaveDisplayValue(steps);
  };
  // The folders of the app's cache that were deleted, by name.
  const deletedFolderNames = () =>
    jest
      .mocked(Directory)
      .mock.results.map(({ value }) => value as { delete: jest.Mock; name: string })
      .filter((folder) => folder.delete.mock.calls.length > 0)
      .map(({ name }) => name);

  test('A PDF fills in a new recipe, page after page', ({ and, then, when }) => {
    when(
      /^I fill in a new recipe from a PDF whose first page has "(.*)" and "(.*)" and its second page "(.*)"$/,
      async (title: string, ingredient: string, steps: string) => {
        givenPdf(2, [
          readPage([{ height: TITLE_HEIGHT, text: title }, body('Ingrédients'), body(ingredient)]),
          readPage([body('Préparation'), body(steps)]),
        ]);
        await chooseFile('tarte.pdf', 'application/pdf');
      },
    );
    then(
      /^the new recipe opens filled in with "(.*)", "(.*)" and "(.*)"$/,
      async (title: string, ingredient: string, steps: string) => {
        await expectFilledIn(title, ingredient, steps);
      },
    );
    and("the PDF's page images are deleted", async () => {
      await waitFor(() => expect(deletedFolderNames()).toContain('1'));
    });
  });

  test('Only the first 5 pages of a long PDF are read', ({ and, then, when }) => {
    when(/^I fill in a new recipe from a PDF of (\d+) pages$/, async (pageCount: string) => {
      const pageList = Array.from({ length: 5 }, (_, index) =>
        readPage([{ height: TITLE_HEIGHT, text: `Page ${index + 1}` }, body('Préparation')]),
      );
      givenPdf(Number(pageCount), pageList);
      await chooseFile('livre.pdf', 'application/pdf');
    });
    then(/^only its first (\d+) pages are read$/, async (maxPages: string) => {
      await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));

      expect(renderPdfPages).toHaveBeenLastCalledWith(
        'file:///data/cache/DocumentPicker/livre.pdf',
        Number(maxPages),
        1600,
      );
      expect(recognizeText).toHaveBeenCalledTimes(Number(maxPages));
    });
    and(/^I am told that only its first (\d+) pages were read$/, async (maxPages: string) => {
      await waitFor(() =>
        expect(alert.spy).toHaveBeenLastCalledWith(
          'A long PDF',
          `Only its first ${maxPages} pages were read: check the end of the recipe.`,
          expect.anything(),
        ),
      );
    });
  });

  test('A document fills in a new recipe', ({ then, when }) => {
    when(
      /^I fill in a new recipe from (.*) "(.*)" listing "(.*)" then "(.*)"$/,
      async (document: string, title: string, ingredient: string, steps: string) => {
        const paragraphList = ['Ingrédients', ingredient, 'Préparation', steps];
        if (document === 'a Word document') {
          givenFileContent({ bytes: wordDocument(title, paragraphList) });
          await chooseFile(
            'soupe.docx',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          );
        } else if (document === 'an OpenDocument text') {
          givenFileContent({ bytes: openDocument(title, paragraphList) });
          await chooseFile('soupe.odt', 'application/vnd.oasis.opendocument.text');
        } else {
          givenFileContent({ text: [title, ...paragraphList].join('\n') });
          await chooseFile('soupe.txt', 'text/plain');
        }
      },
    );
    then(
      /^the new recipe opens filled in with "(.*)", "(.*)" and "(.*)"$/,
      async (title: string, ingredient: string, steps: string) => {
        await expectFilledIn(title, ingredient, steps);
      },
    );
  });

  test("An old Word document can't be read", ({ and, then, when }) => {
    when(/^I choose the file "(.*)" for a new recipe$/, async (name: string) => {
      await chooseFile(name, 'application/msword');
    });
    then('I am told to save it as .docx first', async () => {
      await waitFor(() =>
        expect(alert.spy).toHaveBeenLastCalledWith(
          'This file can’t be read',
          expect.stringContaining('save them as .docx first'),
          expect.anything(),
        ),
      );
    });
    and('no recipe form opens', () => {
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  test("A PDF that can't be opened", ({ and, then, when }) => {
    when('I choose a PDF protected by a password for a new recipe', async () => {
      jest.mocked(renderPdfPages).mockRejectedValueOnce(new Error('Password required'));
      await chooseFile('secret.pdf', 'application/pdf');
    });
    then("I am told that the file couldn't be read", async () => {
      await waitFor(() =>
        expect(alert.spy).toHaveBeenLastCalledWith(
          expect.stringContaining('The file couldn’t be read'),
          undefined,
          expect.anything(),
        ),
      );
    });
    and('the copies of the file are deleted', () => {
      expect(deletedFolderNames()).toContain('DocumentPicker');
    });
  });
});
