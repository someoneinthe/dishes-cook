import { inArray } from 'drizzle-orm';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
} from 'expo-image-picker';
import type { AppDatabase } from '@/db/types';
import type { PhotoStore } from '@/features/sync/sync-engine';
import { recipes } from '@/db/schema';

// Recipes' photos: JPEG files in the app's documents (kept with the app's data), one per recipe,
// named at random. The database keeps the file's name (recipes.photo_file).

// The documents folder of the photos.
export const RECIPE_PHOTO_FOLDER = 'recipe-photos';

// Long side of a saved photo, in pixels: sharp on a phone or a TV, a few hundred KB.
const MAX_PHOTO_SIDE = 1280;
const JPEG_QUALITY = 0.8;

// Where the photo picker and the manipulator leave their copies (the app's cache).
const TEMPORARY_FOLDERS = ['ImagePicker', 'ImageManipulator'] as const;

// Files checked per query when sweeping unused photos.
const SWEEP_BATCH = 50;

// 'denied': the camera isn't allowed (the user can allow it in the phone's settings).
export type PickResult = 'cancelled' | 'denied' | Readonly<{ file: string }>;

// Deletes a recipe's photo file (replaced, removed, or its recipe deleted). One that can't be
// deleted is swept at the next start.
export function deleteRecipePhoto(file: string): void {
  try {
    const photo = recipePhotoFile(file);
    if (photo.exists) {
      photo.delete();
    }
  } catch {
    // Swept later (deleteUnusedPhotos).
  }
}

// Deletes the photos no recipe uses any more: replaced or removed by a sync, or picked in a form
// that wasn't saved. Run at start.
export function deleteUnusedPhotos(database: AppDatabase): void {
  try {
    const folder = new Directory(Paths.document, RECIPE_PHOTO_FOLDER);
    if (!folder.exists) {
      return;
    }
    const nameList = folder
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => file.name);
    for (let start = 0; start < nameList.length; start += SWEEP_BATCH) {
      const unusedList = unusedNames(database, nameList.slice(start, start + SWEEP_BATCH));
      for (const name of unusedList) {
        deleteRecipePhoto(name);
      }
    }
  } catch {
    // Tried again at the next start.
  }
}

// The photos as the sync reads and writes them (src/features/sync/sync-engine.ts).
export const recipePhotoStore: PhotoStore = {
  delete: deleteRecipePhoto,
  download: async (url) => {
    const photo = new File(photoFolder(), newPhotoName());
    await File.downloadFileAsync(url, photo);
    return photo.name;
  },
  // The file itself: a Blob, which the app's fetch (Expo's) sends. It refuses React Native's
  // { uri, name, type } files.
  toUpload: (file) => {
    const photo = recipePhotoFile(file);
    return photo.exists ? photo : undefined;
  },
};

// Where a recipe's photo comes from: the camera, or the phone's photos.
export type PhotoSource = 'camera' | 'library';

// Takes a photo or picks one, cropped by the picker, then saves it resized as a recipe photo.
export async function pickRecipePhoto(source: PhotoSource): Promise<PickResult> {
  if (source === 'camera') {
    const { granted: isGranted } = await requestCameraPermissionsAsync();
    if (!isGranted) {
      return 'denied';
    }
  }
  const options = {
    allowsEditing: true,
    aspect: [4, 3] as [number, number],
    mediaTypes: 'images' as const,
  };
  try {
    const result = await (source === 'camera'
      ? launchCameraAsync(options)
      : launchImageLibraryAsync(options));
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) {
      return 'cancelled';
    }
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > MAX_PHOTO_SIDE) {
      context.resize(
        asset.width >= asset.height ? { width: MAX_PHOTO_SIDE } : { height: MAX_PHOTO_SIDE },
      );
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    const photo = new File(photoFolder(), newPhotoName());
    await new File(saved.uri).move(photo);
    return { file: photo.name };
  } finally {
    deleteTemporaryCopies();
  }
}

// The photo's file (it may be missing: not downloaded yet, or deleted).
export function recipePhotoFile(file: string): File {
  return new File(Paths.document, RECIPE_PHOTO_FOLDER, file);
}

// The picker's and the manipulator's copies of the photo (the user's own photos are elsewhere).
function deleteTemporaryCopies(): void {
  for (const name of TEMPORARY_FOLDERS) {
    try {
      const folder = new Directory(Paths.cache, name);
      if (folder.exists) {
        folder.delete();
      }
    } catch {
      // The cache: Android clears it when it needs room.
    }
  }
}

// The time of the last photo name given (see newPhotoName).
const nameClock = { last: 0 };

// A new photo's file name: the time, in ms, one later than the last name if two are given in the
// same ms. It needn't be secret (the app's private files) and is never reused: if the clock went
// back onto an existing photo, saving onto it fails, nothing is overwritten.
function newPhotoName(): string {
  nameClock.last = Math.max(Date.now(), nameClock.last + 1);
  return [nameClock.last.toString(36), 'jpg'].join('.');
}

// The photos' folder, created if needed.
function photoFolder(): Directory {
  const folder = new Directory(Paths.document, RECIPE_PHOTO_FOLDER);
  folder.create({ idempotent: true, intermediates: true });
  return folder;
}

// The names of the list that no recipe uses.
function unusedNames(database: AppDatabase, nameList: readonly string[]): string[] {
  const usedSet = new Set(
    database
      .select({ photoFile: recipes.photoFile })
      .from(recipes)
      .where(inArray(recipes.photoFile, [...nameList]))
      .all()
      .map(({ photoFile }) => photoFile),
  );
  return nameList.filter((name) => !usedSet.has(name));
}
