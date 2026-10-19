import { Directory, File } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { deleteSharedPdfs, shareRecipePdf, toFileName } from './share-recipe-pdf';

describe('share recipe pdf', () => {
  describe('shareRecipePdf', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    // The temporary folders deleted (the mock's folders all exist).
    const deletedFolderNames = () =>
      jest
        .mocked(Directory)
        .mock.results.map(({ value }) => value as { delete: jest.Mock; name: string })
        .filter(({ delete: deleteFolder }) => deleteFolder.mock.calls.length > 0)
        .map(({ name }) => name);

    it('makes the PDF on the page size of the reader’s units, named after the recipe, and shares it', async () => {
      await shareRecipePdf({
        dialogTitle: 'Share Soup',
        html: '<p>Soup</p>',
        title: 'Soup',
        units: 'metric',
      });

      expect(printToFileAsync).toHaveBeenCalledWith({
        height: 842,
        html: '<p>Soup</p>',
        width: 595,
      });

      const printed = jest
        .mocked(File)
        .mock.results.find(
          ({ value }) => (value as { uri: string }).uri === 'file:///data/cache/Print/0f1e.pdf',
        )?.value as { move: jest.Mock };

      expect(printed.move).toHaveBeenCalledWith(
        expect.objectContaining({ uri: 'file:///data/cache/shared-pdf/Soup.pdf' }),
        { overwrite: true },
      );
      expect(shareAsync).toHaveBeenCalledWith('file:///data/cache/shared-pdf/Soup.pdf', {
        dialogTitle: 'Share Soup',
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
      // Deleted once the share sheet closes: nothing is kept.
      expect(deletedFolderNames()).toStrictEqual(['Print', 'shared-pdf']);
    });

    it('uses US Letter pages with US units', async () => {
      await shareRecipePdf({ dialogTitle: 'Share', html: '', title: 'Soup', units: 'us' });

      expect(printToFileAsync).toHaveBeenCalledWith({ height: 792, html: '', width: 612 });
    });

    it('deletes the temporary files when sharing fails too', async () => {
      jest.mocked(shareAsync).mockRejectedValueOnce(new Error('No app to share with'));

      await expect(
        shareRecipePdf({ dialogTitle: 'Share', html: '', title: 'Soup', units: 'metric' }),
      ).rejects.toThrow('No app to share with');
      expect(deletedFolderNames()).toStrictEqual(['Print', 'shared-pdf']);
    });

    it('deletes the leftovers of an earlier share', () => {
      deleteSharedPdfs();

      expect(deletedFolderNames()).toStrictEqual(['Print', 'shared-pdf']);
    });
  });

  describe('toFileName', () => {
    it('keeps a title, without the characters a file name can’t hold', () => {
      expect(toFileName('Soupe / potiron : maison?')).toBe('Soupe potiron maison');
      expect(toFileName('Crème brûlée')).toBe('Crème brûlée');
      expect(toFileName('a\u{0}b\nc')).toBe('a b c');
    });

    it('shortens a long title, and names an unusable one “recipe”', () => {
      expect(toFileName('x'.repeat(200))).toHaveLength(80);
      expect(toFileName('..')).toBe('recipe');
      expect(toFileName('???')).toBe('recipe');
    });
  });
});
