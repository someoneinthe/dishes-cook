@AGENTS.md

## Claude Code notes

- **Product**: an Android-first app (iOS later) that suggests what to eat from the recipes the user has saved. Data is local-only for now; don't introduce a backend, accounts or network calls without asking.
- **Before saying a task is done**: run `npm run check`. Run `npm run doctor` too after touching dependencies or `app.config.ts`.
- **Check every user-facing change on a device before shipping it** (before opening the PR or calling it done): run it with `/run-android` and go through the changed flows: create, edit, delete, navigate away and back. A launch alone doesn't count. Jest runs on Node, not Hermes: `Array.prototype.toSorted` passed every test and crashed the app on launch. Report what you checked on the device, and anything you couldn't check.
- **Lists load at most 50 rows per query, with pagination**: never read a whole table into a screen. Use `usePagedQuery` (keyset pages of `PAGE_SIZE` = 50, infinite scroll, `MAX_PAGES` kept in memory) with a `(sort_key, id)` index, and `LIMIT` any other list query (suggestions, pickers). Counts and random picks are done in SQL, not by loading ids. Data goes through TanStack Query; writes go through Drizzle, which invalidates the queries. See `docs/database.md`.
- **Sorting, filtering and ordering MUST happen in the data layer, never in the front**: in SQL (`ORDER BY`, `WHERE`, `LIMIT`) in `src/features/*/db/*-queries.ts` today, in the API when there is one. Screens, hooks and components display rows in the order they come, as they come: no `.sort()`, `.filter()`, search or ranking on fetched data. Paginated results can't be sorted or filtered correctly after the fact anyway. Editing local UI state (e.g. removing an item from a form's selection) isn't data filtering.
- **Always confirm deletions**: every removal (recipe, ingredient, anything added later) asks first, with `useConfirmDelete` (`src/components/use-confirm-delete.ts`). ESLint refuses destructive dialog buttons elsewhere.
- **UI text is translated (EN + FR)**: never write user-facing text (JSX text, labels, hints, placeholders, alerts) in a component; add it to `src/i18n/en.ts` **and** `src/i18n/fr.ts` (TypeScript fails if French is missing an entry) and read it with `useMessages()`. Names and counts go through functions (plurals differ: French uses the singular for 0). Check new screens in both languages (Settings › Language). User content in the database is never translated.
- **Text follows the phone's font size** (accessibility): sizes come from `theme.typography` in dp, which React Native scales with the system font setting. Never set `allowFontScaling={false}` or `maxFontSizeMultiplier`, never give text containers a fixed `height` (use `minHeight`), let rows wrap (`flexWrap`) instead of squeezing text, and size icons with `useIconSize` so they grow with the text. Check new screens at a large font: `adb shell settings put system font_scale 1.3` (and `2.0`), then back to `1.0`.
- **Buttons** (always `Button`, never a bare `Pressable` styled as a button):
  - **Colors**: the primary action is blue with white text (`variant="primary"`, default); a deletion is red with white text and always an icon (`variant="danger"`, `icon="trash-can-outline"`, required by the types); other actions are outlined (`variant="secondary"`).
  - **Icon only when the icon speaks for itself** (+ add, ✏️ edit, 🗑 delete, ✓ save, ✕ cancel): `isIconOnly`, the `label` stays for screen readers. **Icon + text** when the icon alone isn't enough (e.g. 🎲 Suggest), **text only** when no icon fits.
  - **Screen actions go in the header**, top right: `<Stack.Screen>` / `<Drawer.Screen options={{ headerRight }}>` with `HeaderActions`. Actions on one item (a list row) stay in the row.
  - Icons: `src/components/icon.tsx` (Material Design Icons); colors: `actionPrimary` / `actionDanger` / `onAction` tokens (selected controls — segmented choices, chips, active menu entry — use the same blue).
- **Formatting is automatic**: a PostToolUse hook (`.claude/hooks/format-file.sh`) runs ESLint `--fix` + Prettier on every file you write/edit. Don't hand-format.
- **Dependencies**: always `npx expo install <pkg>`; justify any new dependency in the PR description.
- **Generated / release-owned files — never edit by hand**: `android/`, `ios/`, `CHANGELOG.md`, `.release-please-manifest.json`, and the `version` field in `package.json` (release-please owns them).
- **Commits & PRs**: Conventional Commits; the PR title is the squash commit and drives the version bump (`feat` → minor, `fix` → patch). Branch from `main` as `feat/…`, `fix/…`, `chore/…`.
- **Never merge, always rebase**: never bring `main` into a branch with a merge commit (no `git merge main`, no default `gh pr update-branch`). Rebase instead (`git rebase origin/main` then `git push --force-with-lease`, or `gh pr update-branch --rebase`). Force-push only feature branches, never `main`.
- **Assign PRs to the author**: always open PRs with `gh pr create --assignee @me`.
- **Expo APIs change every SDK**: check the versioned docs for the installed `expo` major (see above) instead of relying on memory.

## Project skills

- `/new-feature <name>` — scaffold a feature folder, screen, route and test.
- `/run-android` — build, install and run the app on an Android emulator, screenshot and inspect it.
- `/add-dependency <pkg>` — add a package the Expo-compatible way and validate it.
- `/upgrade-expo-sdk` — upgrade to the next Expo SDK.
- `/release-status` — what the next release will contain and whether it's ready.

Agent `convention-reviewer` reviews a diff against the conventions in `CONTRIBUTING.md`.
