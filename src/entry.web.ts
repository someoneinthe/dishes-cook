import { startWebDatabase } from './db/web-database';
import { loadRecipePhotos } from './features/recipes/recipe-photos.web';
import { showStartError } from './web-start-error';

async function listPhotos(): Promise<void> {
  try {
    await loadRecipePhotos();
  } catch {
    // The recipes show without their photos.
  }
}

// The app's start in a browser: the database's worker (see startWebDatabase) and the list of
// photos (the screens read it synchronously), then the app as on a phone (src/entry.ts). The
// database needs a cross-origin isolated page (the server's headers, server/hooks/web-app.pb.js):
// without one, or when it can't open, the page says so instead of staying blank. Photos that can't
// be listed don't stop the app: the recipes show without them.
async function start(): Promise<void> {
  if (!globalThis.crossOriginIsolated) {
    showStartError('unsupported');
    return;
  }
  try {
    await Promise.all([startWebDatabase(), listPhotos()]);
    await import('./start-app');
  } catch {
    showStartError('failed');
  }
}

// The browser is asked to keep the site's data (the database, the photos) when it needs room; it
// may still clear it when the user does, which the About page says. A page that isn't secure (plain
// HTTP, not localhost) has no storage at all: it shows the unsupported message.
const storage: StorageManager | undefined = navigator.storage;
void storage?.persist().catch(() => false);
void start();
