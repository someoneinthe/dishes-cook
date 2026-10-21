import { Directory, File } from 'expo-file-system';
import { ImageManipulator } from 'expo-image-manipulator';
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
} from 'expo-image-picker';
import type { AppDatabase } from '@/db/types';
import { createTestConnection } from '@/test/test-database';
import { saveRecipe } from './db/recipe-queries';
import { deleteUnusedPhotos, pickRecipePhoto, recipePhotoStore } from './recipe-photos';

type MockFile = Readonly<{
  delete: { mock: { calls: unknown[][] } };
  move: { mock: { calls: unknown[][] } };
  name: string;
  uri: string;
}>;

const picked = (width: number, height: number) =>
  Promise.resolve({
    assets: [{ height, uri: 'file:///data/cache/ImagePicker/picked.jpg', width }],
    canceled: false,
  }) as ReturnType<typeof launchImageLibraryAsync>;

describe('recipe photos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The resizes asked of the manipulator.
  const resizeCalls = () => {
    const { manipulate } = ImageManipulator as unknown as {
      manipulate: { mock: { results: { value: unknown }[] } };
    };
    const context = manipulate.mock.results[0]?.value as {
      resize: { mock: { calls: unknown[][] } };
    };
    return context.resize.mock.calls;
  };
  // Where the resized photo was moved.
  const resizedMovedTo = () => {
    const resized = createdFiles().find(({ uri }) => uri.endsWith('resized.jpg'));
    const [destination] = (resized?.move.mock.calls[0] ?? []) as [{ uri: string }?];
    return destination?.uri ?? '';
  };
  const createdFiles = () => jest.mocked(File).mock.results.map(({ value }) => value as MockFile);
  const deletedFolderNames = () =>
    jest
      .mocked(Directory)
      .mock.results.map(
        ({ value }) => value as { delete: { mock: { calls: unknown[][] } }; name: string },
      )
      .filter(({ delete: removal }) => removal.mock.calls.length > 0)
      .map(({ name }) => name);

  describe('pickRecipePhoto', () => {
    it('resizes a picked photo to 1280 px on its long side and keeps it in the documents', async () => {
      jest.mocked(launchImageLibraryAsync).mockReturnValueOnce(picked(3000, 4000));

      const result = await pickRecipePhoto('library');

      expect(resizeCalls()).toStrictEqual([[{ height: 1280 }]]);
      expect(resizedMovedTo()).toMatch(/^file:\/\/\/data\/files\/recipe-photos\/[\w-]+\.jpg$/);
      expect(result).toStrictEqual({ file: resizedMovedTo().split('/').at(-1) });
      // The picker's and the manipulator's copies.
      expect(deletedFolderNames()).toStrictEqual(['ImagePicker', 'ImageManipulator']);
    });

    it('keeps a small photo’s size', async () => {
      jest.mocked(launchImageLibraryAsync).mockReturnValueOnce(picked(800, 600));

      await pickRecipePhoto('library');

      expect(resizeCalls()).toStrictEqual([]);
    });

    it('says when the camera isn’t allowed, and when nothing was picked', async () => {
      jest.mocked(requestCameraPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);

      await expect(pickRecipePhoto('camera')).resolves.toBe('denied');
      expect(launchCameraAsync).not.toHaveBeenCalled();
      await expect(pickRecipePhoto('library')).resolves.toBe('cancelled');
    });
  });

  describe('deleteUnusedPhotos', () => {
    let database: AppDatabase;

    beforeEach(() => {
      ({ db: database } = createTestConnection());
    });

    it('deletes the photos no recipe uses', () => {
      saveRecipe(database, {
        ingredientIdList: [],
        instructions: '',
        photo: { file: 'used.jpg' },
        season: 'both',
        title: 'Soup',
      });
      // Files as the folder lists them (real File instances in the app).
      const fileOf = (name: string) =>
        Object.setPrototypeOf(
          new File('file:///data/files/recipe-photos', name),
          File.prototype,
        ) as File;
      const fileList = [fileOf('used.jpg'), fileOf('unused.jpg')];
      jest
        .mocked(Directory)
        .mockReturnValueOnce({ exists: true, list: () => fileList } as unknown as Directory);
      jest.mocked(File).mockClear();

      deleteUnusedPhotos(database);

      const deletedList = createdFiles()
        .filter(({ delete: removal }) => removal.mock.calls.length > 0)
        .map(({ name }) => name);

      expect(deletedList).toStrictEqual(['unused.jpg']);
    });
  });

  describe('recipePhotoStore', () => {
    it('uploads a photo’s file itself (a Blob), and downloads one into a new file', async () => {
      const upload = recipePhotoStore.toUpload('a.jpg');

      // The File, not React Native's { uri, name, type }, which Expo's fetch refuses.
      expect(upload).toBe(jest.mocked(File).mock.results.at(-1)?.value);
      expect(upload).toMatchObject({ uri: 'file:///data/files/recipe-photos/a.jpg' });

      const name = await recipePhotoStore.download('https://example.org/api/files/x?token=t');

      expect(name).toMatch(/^[\w-]+\.jpg$/);

      const { downloadFileAsync } = File as unknown as {
        downloadFileAsync: { mock: { calls: [string, { name: string }][] } };
      };

      expect(downloadFileAsync.mock.calls).toStrictEqual([
        ['https://example.org/api/files/x?token=t', expect.objectContaining({ name })],
      ]);
    });
  });
});
