import { inArray } from 'drizzle-orm';
import type { AppDatabase } from '@/db/types';
import { recipes } from '@/db/schema';

// What recipe photos share on a phone (recipe-photos.ts) and in a browser (recipe-photos.web.ts).

// Where a recipe's photo comes from: the camera, or the phone's photos (a browser has only files).
export type PhotoSource = 'camera' | 'library';

// A recipe's photo as the screens read it.
export type StoredPhoto = Readonly<{
  base64: () => Promise<string>;
  exists: boolean;
  uri: string;
}>;

// The time of the last photo name given (see newPhotoName).
const nameClock = { last: 0 };

// A new photo's file name: the time, in ms, one later than the last name if two are given in the
// same ms. It needn't be secret (the app's private files) and is never reused: if the clock went
// back onto an existing photo, saving onto it fails, nothing is overwritten.
export function newPhotoName(): string {
  nameClock.last = Math.max(Date.now(), nameClock.last + 1);
  return [nameClock.last.toString(36), 'jpg'].join('.');
}

// The names of the list that no recipe uses.
export function unusedNames(database: AppDatabase, nameList: readonly string[]): string[] {
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
