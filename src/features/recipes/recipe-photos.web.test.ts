import { ImageManipulator } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { fakeObjectUrls, fakePrivateFiles, removeBrowser, setBrowser } from '@/test/browser';
import { createTestConnection } from '@/test/test-database';
import { saveRecipe } from './db/recipe-queries';
import {
  deleteRecipePhoto,
  deleteUnusedPhotos,
  loadRecipePhotos,
  pickRecipePhoto,
  recipePhotoFile,
  recipePhotoStore,
} from './recipe-photos.web';

// The manipulator's context in a browser, which crops too: the photo is saved as a blob address.
const manipulatorContext = () => {
  const context = {
    crop: jest.fn(),
    renderAsync: jest.fn(() =>
      Promise.resolve({ saveAsync: jest.fn(() => Promise.resolve({ uri: 'blob:saved' })) }),
    ),
    resize: jest.fn(),
  };
  jest
    .spyOn(ImageManipulator, 'manipulate')
    .mockReturnValueOnce(context as unknown as ReturnType<typeof ImageManipulator.manipulate>);
  return context;
};

const picked = (width: number, height: number) =>
  Promise.resolve({
    assets: [{ height, uri: 'blob:picked', width }],
    canceled: false,
  }) as ReturnType<typeof launchImageLibraryAsync>;

describe('recipe photos in a browser', () => {
  let files: ReturnType<typeof fakePrivateFiles>;
  let urls: ReturnType<typeof fakeObjectUrls>;

  beforeEach(() => {
    files = fakePrivateFiles();
    urls = fakeObjectUrls();
    setBrowser({ navigator: { storage: files.storage } });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['jpeg'])));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    removeBrowser();
  });

  it('crops a chosen photo to 4:3 around its middle, without shrinking a small one', async () => {
    const context = manipulatorContext();
    jest.mocked(launchImageLibraryAsync).mockReturnValueOnce(picked(2000, 900));

    const result = await pickRecipePhoto('camera');

    expect(context.crop).toHaveBeenCalledWith({
      height: 900,
      originX: 400,
      originY: 0,
      width: 1200,
    });
    expect(context.resize).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ file: expect.stringMatching(/\.jpg$/) as string });
  });

  it('saves the chosen photo, which the screens then read', async () => {
    manipulatorContext();
    jest.mocked(launchImageLibraryAsync).mockReturnValueOnce(picked(1200, 900));

    const { file } = (await pickRecipePhoto('library')) as { file: string };

    expect(files.folderMap.get('recipe-photos')?.has(file)).toBe(true);
    expect(recipePhotoFile(file)).toMatchObject({
      exists: true,
      uri: expect.stringMatching(/^blob:/) as string,
    });
    await expect(recipePhotoFile(file).base64()).resolves.toBe(btoa('jpeg'));
    // The manipulator's copy is let go once saved.
    expect(urls.revokedList).toContain('blob:saved');
  });

  it('shrinks a large photo to 1280 pixels wide', async () => {
    const context = manipulatorContext();
    jest.mocked(launchImageLibraryAsync).mockReturnValueOnce(picked(3000, 4000));

    await pickRecipePhoto('library');

    expect(context.crop).toHaveBeenCalledWith({
      height: 2250,
      originX: 0,
      originY: 875,
      width: 3000,
    });
    expect(context.resize).toHaveBeenCalledWith({ width: 1280 });
  });

  it('keeps nothing when the choice is cancelled', async () => {
    await expect(pickRecipePhoto('library')).resolves.toBe('cancelled');
  });

  it('deletes a photo and forgets it', async () => {
    const photo = await recipePhotoStore.download('https://sync.example.org/photo.jpg');

    expect(recipePhotoStore.toUpload(photo)).toBeInstanceOf(Blob);

    deleteRecipePhoto(photo);
    // Removing the file is let go: the page doesn't wait for it.
    await new Promise(setImmediate);

    expect(recipePhotoFile(photo).exists).toBe(false);
    expect(files.folderMap.get('recipe-photos')?.has(photo)).toBe(false);
    expect(recipePhotoStore.toUpload(photo)).toBeUndefined();
    await expect(recipePhotoFile(photo).base64()).rejects.toThrow('No photo');
  });

  it('fails a download the server refuses', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));

    await expect(recipePhotoStore.download('https://sync.example.org/gone.jpg')).rejects.toThrow(
      'Photo download failed: 404',
    );
  });

  it('lists the saved photos at start, and sweeps those no recipe uses', async () => {
    const folder = new Map([
      ['unused.jpg', { blob: new Blob(['b']), name: 'unused.jpg' }],
      ['used.jpg', { blob: new Blob(['a']), name: 'used.jpg' }],
    ]);
    files.folderMap.set('recipe-photos', folder);
    const { db } = createTestConnection();
    saveRecipe(db, {
      ingredientIdList: [],
      instructions: '',
      photo: { file: 'used.jpg' },
      season: 'both',
      title: 'Soup',
    });

    await loadRecipePhotos();

    expect(recipePhotoFile('unused.jpg').exists).toBe(true);

    deleteUnusedPhotos(db);
    await new Promise(setImmediate);

    expect([...folder.keys()]).toStrictEqual(['used.jpg']);
    expect(recipePhotoFile('used.jpg').exists).toBe(true);
    expect(recipePhotoFile('unused.jpg')).toMatchObject({ exists: false, uri: '' });
  });

  it('leaves out a photo it can’t read: the others load', async () => {
    files.folderMap.set(
      'recipe-photos',
      new Map([
        ['fine.jpg', { blob: new Blob(['a']), name: 'fine.jpg' }],
        ['unreadable.jpg', { blob: new Blob(['b']), name: 'unreadable.jpg' }],
      ]),
    );

    await loadRecipePhotos();

    expect(recipePhotoFile('fine.jpg').exists).toBe(true);
    expect(recipePhotoFile('unreadable.jpg').exists).toBe(false);
  });

  it('never saves over a photo already there (a clock gone back)', async () => {
    // Far ahead of every name given so far: the next name is this time's.
    const time = Date.now() + 1_000_000_000;
    const taken = `${time.toString(36)}.jpg`;
    const folder = new Map([[taken, { blob: new Blob(['kept']), name: taken }]]);
    files.folderMap.set('recipe-photos', folder);
    jest.spyOn(Date, 'now').mockReturnValue(time);

    await expect(recipePhotoStore.download('https://sync.example.org/photo.jpg')).rejects.toThrow(
      'already exists',
    );
    await expect(new Response(folder.get(taken)?.blob).text()).resolves.toBe('kept');
  });
});
