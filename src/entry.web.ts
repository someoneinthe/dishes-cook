import { startWebDatabase } from './db/web-database';

// The app's start in a browser: the database's worker first (see startWebDatabase), then the app
// as on a phone (src/entry.ts).
void startWebDatabase().then(() => import('./start-app'));
