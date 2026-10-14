# Server sync

The phone's database is the source of truth: the app works the same without a server. Optionally, it syncs with **your own [PocketBase](https://pocketbase.io) server**, so several phones share the same recipes.

## In the app

**Settings › Data storage**: _This phone only_ (the default) or _Synced with a server_. To connect, type the server's address and the email and password of an account created on the server. The phone signs in and keeps only the sign-in token (in `expo-secure-store`), never the password.

- **First sync merges**: the phone's recipes and the server's are combined. An ingredient with the same name on both is one ingredient (see [ids](#ids)).
- **When it syncs**: when the app starts or comes back to the foreground, 5 seconds after the last change (a burst of edits makes one sync), and with _Sync now_. Code: `src/features/sync/auto-sync.tsx`.
- **When the server can't be reached** (away from home, server down), the sync fails quietly: Settings shows it, and the next sync catches up. Nothing is lost: changes stay on the phone until they're pushed.
- **Stopping the sync** keeps the recipes on the phone and on the server. Connecting again merges them again.

## How it works

`synchronize` (`src/features/sync/sync-engine.ts`) runs in two steps:

1. **Pull**: the rows written on the server since the last pull (`updated >= cursor`, ingredients first since recipes link to them), in pages of 50. A pulled row replaces the phone's only if it's newer.
2. **Push**: the deletions made on the phone, then the rows changed since the previous sync started (`updated_at >= pushedFrom`, read on the `(updated_at, id)` indexes), in pages of 50.

| Rule               | How                                                                                                                                                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Newest change wins | Each row carries the time of its last change (`updated_at` on the phone, `modified` on the server, in ms). A pulled row keeps its `modified` as `updated_at`, so it isn't pushed back. The server refuses an update older than what it has (update rule `@request.body.modified >= modified`). |
| Whole rows         | A recipe is one row, its ingredients included (a list of ingredient ids on the server): two phones changing the same recipe keep the newest version, not a mix.                                                                                                                                |
| Deletions          | The delete queries record the row in `sync_deletions` (same transaction). The push marks it `deleted` on the server, which never removes rows: the other phones see the deletion and delete their copy.                                                                                        |
| Used ingredients   | An ingredient deleted on one phone while a recipe on another uses it is kept, and pushed again.                                                                                                                                                                                                |
| Bad rows           | Rows from the server are checked (id format, non-blank title or name, known season and course) and skipped or corrected, never trusted blindly.                                                                                                                                                |

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

Any PocketBase 0.23+ (tested with 0.40):

1. Copy `server/migrations/*.js` into `pb_migrations/` next to the PocketBase executable and restart it: `pocketbase serve` applies them. They create the `ingredients` and `recipes` collections with their API rules, close sign-up on `users`, and make sign-in tokens last a year (each sync renews it).
2. In the admin UI (`/_/`), create an account in **users** for the phones to sign in with.
3. Serve it over **HTTPS with a valid certificate**: Android refuses plain HTTP. Any reverse proxy works (e.g. Caddy).
4. Back up `pb_data/` (PocketBase has built-in scheduled backups).

## Testing during development

- **Tests** run against `src/test/fake-sync-server.ts`, which mirrors the behaviours below; `sync-engine.test.ts` simulates two phones.
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
