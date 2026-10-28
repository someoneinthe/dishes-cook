import { startWebDatabase } from './db/web-database';
import { loadRecipePhotos } from './features/recipes/recipe-photos.web';

// The app's start in a browser: the database's worker (see startWebDatabase) and the list of
// photos (the screens read it synchronously), then the app as on a phone (src/entry.ts). The
// browser is asked to keep the site's data (the database, the photos) when it needs room; it may
// still clear it when the user does, which the About page says.
void navigator.storage.persist().catch(() => false);
void Promise.all([startWebDatabase(), loadRecipePhotos()]).then(() => import('./start-app'));
