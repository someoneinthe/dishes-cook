import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';
import type { AppDatabase } from '@/db/types';
import type { PhotoStore } from '@/features/sync/sync-photos';
import type { PhotoSource, StoredPhoto } from './recipe-photo-shared';
import { newPhotoName, unusedNames } from './recipe-photo-shared';

export type { PhotoSource, StoredPhoto } from './recipe-photo-shared';

// Recipes' photos in a browser: JPEG files in the site's private storage (the origin private file
// system, beside the database), one per recipe, named like on a phone. They're listed once at start
// (loadRecipePhotos), so the screens read them synchronously as on a phone (recipe-photos.ts).

export const RECIPE_PHOTO_FOLDER = 'recipe-photos';

const MAX_PHOTO_SIDE = 1280;
const JPEG_QUALITY = 0.8;
// The picker crops to 4:3 on a phone; a browser's picker can't, so the photo is cropped here.
const PHOTO_ASPECT = 4 / 3;
const SWEEP_BATCH = 50;

type PickResult = 'cancelled' | 'denied' | Readonly<{ file: string }>;
type WebPhoto = Readonly<{ blob: Blob; uri: string }>;

// The photos saved, by name: their file and an address the page shows them from.
const photoMap = new Map<string, WebPhoto>();

export function deleteRecipePhoto(file: string): void {
  forget(file);
  // A photo that can't be deleted is swept at the next start (deleteUnusedPhotos).
  void photoFolder()
    .then((folder) => folder.removeEntry(file))
    .catch(() => {});
}

export function deleteUnusedPhotos(database: AppDatabase): void {
  const nameList = [...photoMap.keys()];
  for (let start = 0; start < nameList.length; start += SWEEP_BATCH) {
    const unusedList = unusedNames(database, nameList.slice(start, start + SWEEP_BATCH));
    for (const name of unusedList) {
      deleteRecipePhoto(name);
    }
  }
}

// Lists the saved photos, before the first screen (src/entry.web.ts).
export async function loadRecipePhotos(): Promise<void> {
  const folder = await photoFolder();
  const handleList = folder.values();
  for await (const handle of handleList) {
    if (handle.kind === 'file') {
      try {
        remember(handle.name, await handle.getFile());
      } catch {
        // An unreadable photo is left out: its recipe shows without it.
      }
    }
  }
}

export const recipePhotoStore: PhotoStore = {
  delete: deleteRecipePhoto,
  download: async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Photo download failed: ${response.status}`);
    }
    return savePhoto(await response.blob());
  },
  toUpload: (file) => photoMap.get(file)?.blob,
};

// A browser has no camera to open here: a photo is always chosen among the computer's files.
export async function pickRecipePhoto(_source: PhotoSource): Promise<PickResult> {
  const result = await launchImageLibraryAsync({ mediaTypes: 'images' });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) {
    return 'cancelled';
  }
  const context = ImageManipulator.manipulate(asset.uri);
  const crop = centeredCrop(asset.width, asset.height);
  context.crop(crop);
  if (Math.max(crop.width, crop.height) > MAX_PHOTO_SIDE) {
    context.resize({ width: MAX_PHOTO_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  try {
    const response = await fetch(saved.uri);
    const blob = await response.blob();
    return { file: await savePhoto(blob) };
  } finally {
    URL.revokeObjectURL(saved.uri);
  }
}

export function recipePhotoFile(file: string): StoredPhoto {
  const photo = photoMap.get(file);
  return {
    base64: async () => {
      if (!photo) {
        throw new Error(`No photo ${file}`);
      }
      return toBase64(photo.blob);
    },
    exists: photo !== undefined,
    uri: photo?.uri ?? '',
  };
}

// The largest 4:3 rectangle in the middle of the photo.
function centeredCrop(width: number, height: number) {
  const croppedWidth = Math.min(width, Math.round(height * PHOTO_ASPECT));
  const croppedHeight = Math.min(height, Math.round(width / PHOTO_ASPECT));
  return {
    height: croppedHeight,
    originX: Math.round((width - croppedWidth) / 2),
    originY: Math.round((height - croppedHeight) / 2),
    width: croppedWidth,
  };
}

function forget(file: string): void {
  const photo = photoMap.get(file);
  if (!photo) {
    return;
  }

  URL.revokeObjectURL(photo.uri);
  photoMap.delete(file);
}

async function hasFile(folder: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await folder.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function photoFolder(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(RECIPE_PHOTO_FOLDER, { create: true });
}

function remember(file: string, blob: Blob): void {
  forget(file);
  photoMap.set(file, { blob, uri: URL.createObjectURL(blob) });
}

// Saves a photo under a new name; resolves with the name.
async function savePhoto(blob: Blob): Promise<string> {
  const name = newPhotoName();
  const folder = await photoFolder();
  // A file opened to write is replaced on close: a name already taken (the clock went back onto
  // a photo) fails instead, as on a phone.
  if (photoMap.has(name) || (await hasFile(folder, name))) {
    throw new Error(`Photo ${name} already exists`);
  }
  const handle = await folder.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  remember(name, await handle.getFile());
  return name;
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
}
