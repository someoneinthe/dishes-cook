# Server sync

The phone's database is the source of truth: the app works the same without a server. Optionally, it syncs with **your own [PocketBase](https://pocketbase.io) server**, so several phones share the same recipes.

## In the app

**Settings › Data storage**: _This device only_ (the default) or _Synced with a server_. To connect, type the server's address and the email and password of an account created on the server. The phone signs in and keeps only the sign-in token (in `expo-secure-store`), never the password.

- **First sync merges**: the phone's recipes and the server's are combined. An ingredient with the same name on both is one ingredient (see [ids](#ids)).
- **When it syncs**: when the app starts or comes back to the foreground, 5 seconds after the last change (a burst of edits makes one sync), and with _Sync now_. Code: `src/features/sync/use-auto-sync.ts`.
- **When the server can't be reached** (away from home, server down), the sync fails quietly: Settings shows it, and the next sync catches up. Nothing is lost: changes stay on the phone until they're pushed.
- **Stopping the sync** keeps the recipes on the phone and on the server. Connecting again merges them again.

## How it works

`synchronize` (`src/features/sync/sync-engine.ts`) runs in two steps:

1. **Pull**: the rows written on the server since the last pull (`updated >= cursor`, ingredients first since recipes link to them), in pages of 50. A pulled row replaces the phone's only if it's newer.
2. **Push**: the deletions made on the phone, then the rows changed since the previous sync started (`updated_at >= pushedFrom`, read on the `(updated_at, id)` indexes), in pages of 50.

| Rule               | How                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Newest change wins | Each row carries the time of its last change (`updated_at` on the phone, `modified` on the server, in ms). A pulled row keeps its `modified` as `updated_at`, so it isn't pushed back. The server refuses an update older than what it has (update rule `@request.body.modified >= modified`).                                                                             |
| Whole rows         | A recipe is one row, its ingredients included (a list of ingredient ids on the server, and their quantities in `quantities`, normalized like on the phone: `{ "<ingredient id>": { "amount": 500, "unit": "g" } }`, no unit = pieces; a quantity pulled in another unit is normalized on arrival): two phones changing the same recipe keep the newest version, not a mix. |
| Deletions          | The delete queries record the row in `sync_deletions` (same transaction). The push marks it `deleted` on the server, which never removes rows: the other phones see the deletion and delete their copy.                                                                                                                                                                    |
| Used ingredients   | An ingredient deleted on one phone while a recipe on another uses it is kept, and pushed again.                                                                                                                                                                                                                                                                            |
| Bad rows           | Rows from the server are checked (id format, non-blank title or name, known season and course) and skipped or corrected, never trusted blindly.                                                                                                                                                                                                                            |

### Ids

Integer ids stay on the phone. A row's identity across devices is its `sync_id`: 15 characters of `[0-9a-f]`, the format of PocketBase record ids, so the phone creates records with their final id.

- Recipes: random (SQLite `randomblob`).
- Ingredients: derived from the name (`toIngredientSyncId`, a hash of the name key), so "Leek" added on two phones before they sync is one ingredient. Renaming keeps the id.

### Known limits

- **Concurrent edits lose one side, silently** (open problem, solution to find): when the same recipe is changed on two phones between syncs (easy when one is away from home), the newest version by the phones' clocks is kept and the other edit disappears without a warning, even if they touched different fields (title on one, ingredients on the other). Workaround for now: sync before editing a recipe someone else may edit. Options to study: field-by-field merge, or keeping both versions and warning on conflict.
- Times come from each phone's clock: a phone with a clock far off could win or lose against changes it shouldn't.
- An ingredient renamed on one phone to a name another phone already uses for a different ingredient keeps its old name on that phone; recipes there that use it may miss it.
- One server is one shared recipe library: every account sees everything.
- Deleted rows stay on the server (marked `deleted`), so that phones that haven't synced in a while learn about the deletion.

## Server setup

Any PocketBase 0.23+; the version in `server/pocketbase-version` is the one the tests run against (see [Upgrading PocketBase](#upgrading-pocketbase)):

1. Copy `server/migrations/*.js` into `pb_migrations/` next to the PocketBase executable and restart it: `pocketbase serve` applies them. They create the `ingredients` and `recipes` collections with their API rules, close sign-up on `users`, and make sign-in tokens last a year (each sync renews it). When a new app version adds a file there, copy it too and restart: PocketBase applies only the migrations it hasn't run yet, and never re-runs an edited one (so they're never edited, see [database.md](database.md#changing-the-schema)).
2. In the admin UI (`/_/`), create an account in **users** for the phones to sign in with.
3. Serve it over **HTTPS with a valid certificate**: Android refuses plain HTTP. Any reverse proxy works (e.g. Caddy).
4. Back up `pb_data/` (PocketBase has built-in scheduled backups).

## Testing during development

- **Tests** run against `src/test/fake-sync-server.ts`, which mirrors the behaviours below; `sync-engine.test.ts` simulates two phones.
- **Against a real PocketBase**: `npm run test:pocketbase` runs the same two-phone scenarios (`src/test/sync-scenarios.ts`) and checks the behaviours below on a throwaway PocketBase: the version in `server/pocketbase-version` (or `POCKETBASE_VERSION=0.x.y`), downloaded once into `node_modules/.cache/pocketbase` and checked against the release's checksums, started empty with `server/migrations` on a free local port, and stopped afterwards. CI runs it on every PR. Needs `curl` and `unzip` (macOS or Linux).
- **End to end**: `npm run test:e2e` runs the Maestro flow `.maestro/sync.yaml` (connect, merge, deletion) on an emulator against a throwaway PocketBase; see [.maestro/README.md](../.maestro/README.md).
- **On an emulator**, against a throwaway PocketBase (never your real one, its data would mix with test recipes):
  1. Start one with the migrations: `pocketbase serve --dir /tmp/pb-test/pb_data --migrationsDir server/migrations --http 127.0.0.1:8091`, create a superuser (`pocketbase superuser upsert … --dir /tmp/pb-test/pb_data`), then an account in **users** from its admin UI.
  2. Forward the port to the emulator: `adb reverse tcp:8091 tcp:8091`.
  3. In the app, connect to `http://localhost:8091`. Plain HTTP only works in **debug** builds (they allow cleartext for Metro); release builds need HTTPS.
  4. Add, edit and delete recipes, change rows in the admin UI, and check both sides (Settings shows the last sync).

## Server behaviour the app relies on

Measured on a real server, and mirrored by the test server (`src/test/fake-sync-server.ts`):

- A refused or expired token is treated as a guest: lists come back **empty** (not 401), creates get a 400, updates a 404. That's why every sync starts by renewing the token (`auth-refresh`), which does fail with a 401.
- An update refused by the update rule (older change) gets a 404; the app then tries a create, which gets a 400 `validation_not_unique` for an existing id: the server's row is newer, and the next pull brings it.
- `updated` (`2026-10-14 18:03:59.794Z`) sorts as text in time order: it's the pull cursor.

## Upgrading PocketBase

PocketBase hasn't reached 1.0: a minor version can change its API, its API rules or the JS migrations API. The server runs the version in `server/pocketbase-version`, the one the tests pass with.

1. **Read the release notes** of every version in between ([releases](https://github.com/pocketbase/pocketbase/releases)), looking for breaking changes to the records API, auth, API rules and JS migrations (`Collection`, `migrate`).
2. **Test it first**: on a branch, set the new version in `server/pocketbase-version` and run `npm run test:pocketbase` (CI runs it on the PR too). If something fails, fix the app, or add a server migration (never edit one, see [database.md](database.md#changing-the-schema)), then merge.
3. **Back up `pb_data/`** on the server: stop PocketBase and copy the folder, or make a backup from the admin UI (Settings › Backups) and keep a copy off the server.
4. **Replace the executable** with the new version's, downloaded from its release page and checked against that release's `checksums.txt` (not `pocketbase update`: it installs the latest version, not the tested one). Copy any new file of `server/migrations/` into `pb_migrations/`, then start it: PocketBase upgrades `pb_data/` and applies the new migrations on start.
5. **Check**: the admin UI opens with the collections and their records, a phone syncs (Settings › Data storage › Sync now), and a change made on one phone reaches another.
6. **If anything goes wrong**, stop PocketBase and put back both the previous executable and the `pb_data/` backup: the new version may have changed `pb_data/` in a way the old one can't read.
