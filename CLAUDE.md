@AGENTS.md

## Claude Code notes

- **Product**: an Android-first app (iOS later) that suggests what to eat from the recipes the user has saved. Data is local-only for now; don't introduce a backend, accounts or network calls without asking.
- **Before saying a task is done**: run `npm run check`. Run `npm run doctor` too after touching dependencies or `app.config.ts`.
- **Formatting is automatic**: a PostToolUse hook (`.claude/hooks/format-file.sh`) runs ESLint `--fix` + Prettier on every file you write/edit. Don't hand-format.
- **Dependencies**: always `npx expo install <pkg>`; justify any new dependency in the PR description.
- **Generated / release-owned files — never edit by hand**: `android/`, `ios/`, `CHANGELOG.md`, `.release-please-manifest.json`, and the `version` field in `package.json` (release-please owns them).
- **Commits & PRs**: Conventional Commits; the PR title is the squash commit and drives the version bump (`feat` → minor, `fix` → patch). Branch from `main` as `feat/…`, `fix/…`, `chore/…`.
- **Expo APIs change every SDK**: check the versioned docs for the installed `expo` major (see above) instead of relying on memory.

## Project skills

- `/new-feature <name>` — scaffold a feature folder, screen, route and test.
- `/add-dependency <pkg>` — add a package the Expo-compatible way and validate it.
- `/upgrade-expo-sdk` — upgrade to the next Expo SDK.
- `/release-status` — what the next release will contain and whether it's ready.

Agent `convention-reviewer` reviews a diff against the conventions in `CONTRIBUTING.md`.
