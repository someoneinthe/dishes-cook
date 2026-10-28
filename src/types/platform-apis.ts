/* eslint-disable sonarjs/no-wildcard-import -- whole modules compared, types only */
import type * as AlertPhone from '@/components/alert';
import type * as AlertHostPhone from '@/components/alert-host';
import type * as AlertHostWeb from '@/components/alert-host.web';
import type * as AlertWeb from '@/components/alert.web';
import type * as ReadDocumentPhone from '@/features/recipes/read-document';
import type * as ReadDocumentWeb from '@/features/recipes/read-document.web';
import type * as RecipePhotosPhone from '@/features/recipes/recipe-photos';
import type * as RecipePhotosWeb from '@/features/recipes/recipe-photos.web';
import type * as SharePdfPhone from '@/features/recipes/share-recipe-pdf';
import type * as SharePdfWeb from '@/features/recipes/share-recipe-pdf.web';
import type * as SyncTokenPhone from '@/features/sync/sync-token';
import type * as SyncTokenWeb from '@/features/sync/sync-token.web';
/* eslint-enable sonarjs/no-wildcard-import */
import type { SamePlatformApi } from './platform';

// Every web version of a module (`x.web.ts`) checked against its phone version (see
// SamePlatformApi). Add a line with each new one.
export type PlatformApis = [
  // The app only shows dialogs (Alert.alert).
  SamePlatformApi<typeof AlertWeb, { Alert: Pick<typeof AlertPhone.Alert, 'alert'> }>,
  SamePlatformApi<typeof AlertHostWeb, typeof AlertHostPhone>,
  SamePlatformApi<typeof RecipePhotosWeb, typeof RecipePhotosPhone>,
  // toScannedBlocks reads ML Kit's result, the phone's only.
  SamePlatformApi<typeof ReadDocumentWeb, Omit<typeof ReadDocumentPhone, 'toScannedBlocks'>>,
  SamePlatformApi<typeof SharePdfWeb, typeof SharePdfPhone>,
  SamePlatformApi<typeof SyncTokenWeb, typeof SyncTokenPhone>,
];
