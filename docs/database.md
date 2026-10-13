# Database

Local-only SQLite (`expo-sqlite`) accessed through Drizzle ORM. The schema lives in `src/db/schema.ts`; migrations are generated into `src/db/migrations/` and applied at startup.

## Schema

```
ingredients                    recipe_ingredients                 recipes
-----------                    ------------------                 -------
id          INTEGER PK  <----  ingredient_id  (ON DELETE RESTRICT)
name        TEXT               recipe_id      (ON DELETE CASCADE) ---> id           INTEGER PK
name_key    TEXT UNIQUE        PK (recipe_id, ingredient_id)           title        TEXT
created_at  INTEGER (ms)       INDEX (ingredient_id, recipe_id)        season       'winter' | 'summer' | 'both'
                                                                       instructions TEXT
                                                                       created_at, updated_at INTEGER (ms)
```

- **Ingredients are unique** by `name_key` (trimmed, single spaces, lower case, computed by `toNameKey` in `src/lib/text.ts`). Case is ignored, accents are not (`pâte` ≠ `pâté`). The key is computed in JS because SQLite's `NOCASE` only folds ASCII (`Œuf` vs `œuf`).
- **Many-to-many** through `recipe_ingredients`: its composite primary key forbids duplicate links and serves "ingredients of a recipe"; the reverse index serves "recipes using an ingredient". Both cover their queries (no table lookup).
- **Deleting**: a recipe cascades to its links; an ingredient still used by a recipe can't be deleted (`RESTRICT`, and the UI hides the button).
- **Constraints in the database**, not only in the UI: `CHECK` on the season values and on non-blank names/titles, `NOT NULL`, foreign keys (`PRAGMA foreign_keys = ON` on every connection, since SQLite disables them by default).
- **Integer primary keys** are SQLite's rowid: the fastest lookups and joins. If sync between devices comes later, add a UUID column then.
- **No index on `season`**: with 3 values, an index can't beat scanning the table.

## Performance choices

| Choice                                                           | Why                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WAL journal mode                                                 | Faster writes; reads never wait for a write.                                                                                                                                                                                                                                                                                                                                                                                           |
| Synchronous queries (Drizzle's expo driver)                      | Sub-millisecond on this data size; screens get data on the first render, so no loading flash.                                                                                                                                                                                                                                                                                                                                          |
| `useLiveQuery` (`src/db/use-live-query.ts`) instead of Drizzle's | Drizzle's only listens to the FROM table through expo-sqlite's native change events, so usage counts (joins) would go stale, and those events stop arriving after a dev reload. Ours re-runs after every write made through Drizzle (`src/db/change-notifier.ts` reads its logger), once per batch, including cascaded deletes. It's opted out of the React Compiler, which would otherwise memoize `query(db)` and return stale data. |
| List queries skip `instructions`                                 | It can be long; only the recipe screen reads it.                                                                                                                                                                                                                                                                                                                                                                                       |
| Counts with one `GROUP BY`                                       | Usage and ingredient counts come with the list: no N+1 queries.                                                                                                                                                                                                                                                                                                                                                                        |
| Meal choice reads ids only                                       | `findRecipeIds` returns the matching ids (index only); the random pick happens in JS (`pickRandomId`, never the same twice in a row) and only the chosen recipe is loaded. "All selected ingredients" = links of those ingredients grouped by recipe, `HAVING count(*) = n`, starting from the `(ingredient_id, recipe_id)` index.                                                                                                     |
| Sorting in JS (`Intl.Collator`)                                  | SQLite sorts bytes, so `Échalote` would come after `zucchini`. Lists are small.                                                                                                                                                                                                                                                                                                                                                        |

`src/db/query-plans.test.ts` runs `EXPLAIN QUERY PLAN` on these queries and fails if one stops using its index.

## Changing the schema

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` — writes a new SQL migration, its snapshot, and updates `src/db/migrations/migrations.js`. Commit all of them; never edit a migration that has shipped.
3. Migrations run at startup (`DatabaseProvider`), before any screen renders.

Drinks (planned) will likely reuse `recipes` with a `kind` column (`'dish' | 'drink'`) so they share ingredients, live queries and the random pick.

## Tests

Query and screen tests run on a real in-memory SQLite (`better-sqlite3`, the same engine and the same migrations as the app) via `createTestConnection` and `renderWithDatabase` from `src/test/test-database.tsx`.
