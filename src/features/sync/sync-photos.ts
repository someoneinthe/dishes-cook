import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';
import type { AppDatabase } from '@/db/types';
import { recipes } from '@/db/schema';
import type { PhotoUpload, ServerRecipe, SyncApi } from './sync-api';
import { SyncError } from './sync-api';
import { settleAll } from './sync-shared';

// Recipe photos in the sync (sync-engine.ts): downloads of the photos other phones uploaded, uploads
// of the ones taken or removed here (see docs/sync.md › How it works › Photos).

// Recipe photos' files on the phone (src/features/recipes/recipe-photos.ts): what the sync reads,
// writes and deletes.
export type PhotoStore = Readonly<{
  // Deletes a photo's file (replaced by a download).
  delete: (file: string) => void;
  // Downloads a photo into a new file; resolves with its name.
  download: (url: string) => Promise<string>;
  // The photo's file to upload; undefined when it's missing.
  toUpload: (file: string) => PhotoUpload | undefined;
}>;

// At most this many photos downloaded, and uploaded, per sync: the next sync carries on.
const MAX_PHOTOS_PER_SYNC = 20;

// A photo to push: taken here and not uploaded yet, or removed here and still on the server.
export const PHOTO_TO_PUSH = or(
  and(isNotNull(recipes.photoFile), isNull(recipes.photoSynced)),
  and(isNull(recipes.photoFile), isNotNull(recipes.photoSynced)),
);

// A pulled recipe of the same version as the phone's: its photo may have been uploaded since (a
// request of its own, which doesn't change `modified`): it's downloaded.
export function applySameVersionPhoto(
  tx: AppDatabase,
  local:
    | Readonly<{
        id: number;
        photoPending: null | string;
        photoSynced: null | string;
        updatedAt: number;
      }>
    | undefined,
  row: ServerRecipe,
): void {
  // No photo on the server at the same version isn't a removal (a removal comes with a new version,
  // see pushRecipes): the server just hasn't got this phone's photo yet, which the push uploads.
  if (local?.updatedAt !== row.modified || row.deleted > 0 || !row.photo) {
    return;
  }
  const photo = pulledPhoto(row, local);
  if (photo.photoPending !== local.photoPending) {
    tx.update(recipes).set(photo).where(eq(recipes.id, local.id)).run();
  }
}

// Downloads the photos pulled from other phones (photo_pending), a few per sync. The file replaces
// the recipe's photo only if nothing changed it meanwhile; a photo that fails stays to download.
export async function downloadPhotos(
  database: AppDatabase,
  api: SyncApi,
  photos: PhotoStore,
  holdChanges: (write: () => void) => void,
): Promise<void> {
  const rowList = database
    .select({
      id: recipes.id,
      photoFile: recipes.photoFile,
      photoPending: recipes.photoPending,
      syncId: recipes.syncId,
    })
    .from(recipes)
    .where(isNotNull(recipes.photoPending))
    .limit(MAX_PHOTOS_PER_SYNC)
    .all();
  // Side by side, as recipes are pushed; the sync fails only once they have all ended.
  await settleAll(
    rowList.map(async (row) => {
      const pending = row.photoPending ?? '';
      const file = await downloadPhoto(api, photos, row.syncId, pending);
      if (file === undefined) {
        return;
      }
      holdChanges(() => {
        const appliedList = database
          .update(recipes)
          .set({ photoFile: file, photoPending: null, photoSynced: pending })
          .where(and(eq(recipes.id, row.id), eq(recipes.photoPending, pending)))
          .returning({ id: recipes.id })
          .all();
        // Changed meanwhile (another photo, or none): this download isn't wanted any more.
        const unusedFile = appliedList.length === 0 ? file : row.photoFile;
        if (unusedFile !== null) {
          photos.delete(unusedFile);
        }
      });
    }),
  );
}

// Whether the server's photo of a recipe is the one the phone shows (uploaded or downloaded), or
// one it hasn't downloaded yet: then a push of the recipe leaves it.
export function isServerPhotoKept(
  row: Readonly<{
    photoFile: null | string;
    photoPending: null | string;
    photoSynced: null | string;
  }>,
): boolean {
  return row.photoPending !== null || (row.photoFile !== null && row.photoSynced !== null);
}

// A pulled recipe's photo, compared with the phone's: none (the photo goes), the one the phone has,
// or another one, to download (the phone's stays until then).
export function pulledPhoto(
  row: Pick<ServerRecipe, 'photo'>,
  local: Readonly<{ photoSynced: null | string }> | undefined,
): Readonly<{ photoFile?: null; photoPending: null | string; photoSynced?: null }> {
  const name = typeof row.photo === 'string' ? row.photo : '';
  if (name === '') {
    return { photoFile: null, photoPending: null, photoSynced: null };
  }
  return { photoPending: name === local?.photoSynced ? null : name };
}

// Uploads the photos taken here, and marks as gone those removed here (cleared on the server with
// their recipe by pushRecipes, cleared again: harmless), a few per sync. A photo whose recipe
// changed meanwhile (another photo) is pushed by the next sync.
export async function pushPhotos(
  database: AppDatabase,
  api: SyncApi,
  photos: PhotoStore,
  holdChanges: (write: () => void) => void,
): Promise<void> {
  const rowList = database
    .select({
      id: recipes.id,
      photoFile: recipes.photoFile,
      syncId: recipes.syncId,
      updatedAt: recipes.updatedAt,
    })
    .from(recipes)
    .where(PHOTO_TO_PUSH)
    .limit(MAX_PHOTOS_PER_SYNC)
    .all();
  await settleAll(
    rowList.map(async (row) => {
      const upload = row.photoFile === null ? null : photos.toUpload(row.photoFile);
      // Its file is missing (deleted outside the app): the recipe has no photo any more, never
      // uploaded (photoSynced null), so it stops waiting for the push.
      if (upload === undefined) {
        holdChanges(() => {
          database
            .update(recipes)
            .set({ photoFile: null })
            .where(and(eq(recipes.id, row.id), eq(recipes.photoFile, row.photoFile ?? '')))
            .run();
        });
        return;
      }
      const result = await api.setRecipePhoto(row.syncId, upload, row.updatedAt);
      if (result === 'kept-newer') {
        return;
      }
      holdChanges(() => {
        database
          .update(recipes)
          .set({ photoSynced: row.photoFile === null ? null : result.name })
          .where(
            and(
              eq(recipes.id, row.id),
              row.photoFile === null
                ? isNull(recipes.photoFile)
                : eq(recipes.photoFile, row.photoFile),
            ),
          )
          .run();
      });
    }),
  );
}

// Downloads a recipe's photo; resolves with its file, or undefined when this photo failed (tried
// again next time). Fails when it isn't this photo's fault (no server, no sign-in).
async function downloadPhoto(
  api: SyncApi,
  photos: PhotoStore,
  syncId: string,
  name: string,
): Promise<string | undefined> {
  try {
    return await photos.download(await api.recipePhotoUrl(syncId, name));
  } catch (error) {
    if (error instanceof SyncError) {
      throw error;
    }
    return undefined;
  }
}
