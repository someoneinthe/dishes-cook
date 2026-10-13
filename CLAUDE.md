@AGENTS.md

## Claude Code notes

- **Product**: an Android-first app (iOS later) that suggests what to eat from the recipes the user has saved. Data is local-only for now; don't introduce a backend, accounts or network calls without asking.
- **Before saying a task is done**: run `npm run check`. Run `npm run doctor` too after touching dependencies or `app.config.ts`.
- **Check every user-facing change on a device before shipping it** (before opening the PR or calling it done): run it with `/run-android` and go through the changed flows: create, edit, delete, navigate away and back. A launch alone doesn't count. Jest runs on Node, not Hermes: `Array.prototype.toSorted` passed every test and crashed the app on launch. Report what you checked on the device, and anything you couldn't check.
- **Lists load at most 50 rows per query, with pagination**: never read a whole table into a screen. Use `usePagedQuery` (keyset pages of `PAGE_SIZE` = 50, infinite scroll, `MAX_PAGES` kept in memory) with a `(sort_key, id)` index, and `LIMIT` any other list query (suggestions, pickers). Counts and random picks are done in SQL, not by loading ids. Data goes through TanStack Query; writes go through Drizzle, which invalidates the queries. See `docs/database.md`.
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
