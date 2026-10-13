# Contributing

## Workflow

1. Branch from `main`: `feat/<short-topic>`, `fix/<short-topic>`, `chore/<short-topic>`.
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/) — enforced by commitlint in the `commit-msg` hook.
3. **Check user-facing changes on an Android emulator or device** before opening the PR (`npm run android`, or `/run-android` in Claude Code): go through the flows you changed, not only the launch. Tests run on Node, not on Hermes, the engine the app runs on, so they can pass while the app crashes.
4. Open a PR **assigned to yourself** (`gh pr create --assignee @me`). Its **title must be a Conventional Commit** (checked in CI) because PRs are **squash-merged** and the title becomes the commit on `main`.
5. **Every CI job must complete successfully** before merging (enforced by the `main` ruleset): lint, format, typecheck, tests, expo-doctor, SonarQube Cloud, CodeQL, dependency review, a Metro bundle of the JS, and a debug Android build (arm64) **only when the native fingerprint changed** (native dependencies, config plugins, `app.config.ts`, native assets — computed with `@expo/fingerprint`). It's skipped when the PR touches no native input (`package.json`, lockfile, `app.config.ts`, `plugins/`, `assets/`, the build action or `ci.yml`): its fingerprint is then `main`'s, which `main`'s own CI builds. It's also skipped when that fingerprint was already built on your branch or on `main`, so JS-only changes and rebases don't rebuild; run the CI workflow manually to force a build. See [the required checks](docs/release.md#1-repository-settings-already-applied).
6. Keep the branch up to date by **rebasing, never merging** `main` into it: `git rebase origin/main` then `git push --force-with-lease` (or `gh pr update-branch --rebase`). History on branches stays linear.
7. Squash-merge. Never push directly to `main`.

### Commit types and their release impact

| Type                                                     | Release effect (while `0.x`) | After `1.0.0` |
| -------------------------------------------------------- | ---------------------------- | ------------- |
| `feat:`                                                  | minor bump                   | minor bump    |
| `fix:`, `perf:`                                          | patch bump                   | patch bump    |
| `feat!:` / `BREAKING CHANGE:` footer                     | minor bump                   | major bump    |
| `docs:`, `chore:`, `refactor:`, `test:`, `ci:`, `build:` | no release on their own      | no release    |

## Code conventions

- **TypeScript strict**; no `any` unless justified in a comment. Use `import type` for types.
- **Files**: `kebab-case.tsx`; components `PascalCase`, hooks `useCamelCase`. Named exports everywhere except route files (Expo Router needs a default export).
- **Routes are thin**: `src/app/**` only re-exports a screen from `src/features/**`.
- **Imports**: use the `@/` alias for `src/`; ESLint sorts import groups.
- **Dependencies**: add with `npx expo install <pkg>` (SDK-compatible versions), not `npm install`. Prefer Expo modules over third-party ones.
- **Styling**: [Unistyles 3](https://www.unistyl.es/) — `import { StyleSheet } from 'react-native-unistyles'` and `StyleSheet.create((theme) => ({ … }))`. Use theme tokens (`theme.colors.*`, `theme.gap(n)`, `theme.typography.*`, `theme.radius.*` from `src/theme/themes.ts`), never raw colors or magic numbers. Light/dark themes switch automatically with the system setting; add a color token to **both** themes (TypeScript enforces it). For non-style props (e.g. navigation options) read the theme with `useUnistyles()`.
- **Tests**: colocated `*.test.ts(x)`; query by what the user sees (`getByText`, `getByRole`), not test IDs, when possible. Pure logic (e.g. the "what to eat" picker) gets unit tests.
- **Behaviour specs (Gherkin)**: describe user-facing behaviour as scenarios in `<name>.feature` (plain English, no implementation details), next to `<name>.steps.test.tsx`, which implements the steps with [jest-cucumber](https://github.com/bencompton/jest-cucumber) (`loadFeature` + `defineFeature`) and React Native Testing Library. Feature and step files must match: a scenario or step without code fails the run with a suggested snippet. Reuse step functions across scenarios; keep low-level cases in regular `*.test.tsx`. Example: `src/features/loading/loading-screen.feature`.
- **Accessibility**: every touchable has an accessible label/role.
- **Sorting, filtering, ordering in the data layer only**: done in SQL by the query functions (`src/features/*/db`), later by the API, never in screens, hooks or components (no `.sort()` / `.filter()` / search on fetched rows). Text sorts and searches on `sort_key` columns (no case, no accents), since SQLite can't fold accents.
- **Lists**: a query never returns more than 50 rows (`PAGE_SIZE`). Long lists page with `usePagedQuery` (keyset pagination on a `(sort_key, id)` index, infinite scroll, at most `MAX_PAGES` pages in memory); short ones (suggestions) use `LIMIT`. Count, filter and pick in SQL rather than loading rows to do it in JS. Screens read data with TanStack Query hooks (`src/features/*/hooks`); every write made through Drizzle invalidates them.
- **Buttons**: always the `Button` component. Primary action (`variant="primary"`, default): blue background (`actionPrimary`), white text (`onAction`), an icon when relevant. Deletion (`variant="danger"`): red background (`actionDanger`), white text, and always an icon (`trash-can-outline`; required by the types). Other actions: `variant="secondary"` (outlined). Icons: `src/components/icon.tsx`. Native confirmation dialogs (`Alert`) can't be styled.
- Run `npm run check` before pushing.

## Linting

`eslint.config.mjs` (ESLint 10, flat config) follows the SPA's rule set, adapted to React Native. On top of `eslint-config-expo`:

- **typescript-eslint** full `recommendedTypeChecked` preset (recommended + type-aware rules: floating/misused promises, unsafe `any`, `ban-ts-comment`…) and the SPA's `naming-convention`: booleans start with `is`/`can`/`will`/`should`/`has`, arrays end with `List`, types are PascalCase, enum members UPPER_CASE
- Core rules: `curly`, `complexity` (12), `arrow-body-style`, `object-shorthand`, `prefer-template`; unused `eslint-disable` comments are errors
- **unicorn** (tuned like the SPA), **sonarjs**, **perfectionist** (natural sorting of imports, objects, JSX props…), **unused-imports** (auto-removed on `--fix`)
- **react-you-might-not-need-an-effect** (strict) and **react-native** (`no-raw-text`, `no-unused-styles`, `no-inline-styles`, `no-color-literals`, `no-single-element-style-arrays`)
- **@react-native/eslint-plugin** (official, versioned with `react-native`): `no-deep-imports`, `platform-colors`; and `expo/prefer-box-shadow` (cross-platform `boxShadow` instead of `elevation` / `shadow*`)
- **react-native-a11y** (`android` preset; switch to `all` when iOS is added): valid accessibility roles/states/values, no nested touchables
- Tests: **jest** (`all`, with the SPA's exceptions) and **testing-library**
- **eslint-config-prettier** last (Prettier owns formatting)

React Native specifics:

- unicorn rules that push APIs Hermes / React Native lack (`structuredClone`, `Blob#text()`, `URL.canParse`, `AbortSignal.any`, top-level `await`…) are off. Iterator helpers, Set methods and `Promise.withResolvers` are off until verified on a device.
- `sonarjs/pseudo-random` is off: picking a random recipe is the app's purpose.
- `unicorn/filename-case` is kebab-case (`_layout.tsx` excepted), not the SPA's camel/Pascal case.

`eslint-plugin-react` and `eslint-plugin-import` (bundled by Expo), `eslint-plugin-react-native` and `eslint-plugin-react-native-a11y` don't declare ESLint 10 support yet: npm `overrides` in `package.json` let them install with our ESLint, and `@eslint/compat` shims the APIs ESLint 10 removed. Drop both workarounds once those plugins support ESLint 10.

## Code quality (SonarQube Cloud)

CI runs a [SonarQube Cloud](https://sonarcloud.io/project/overview?id=someoneinthe_dishes-cook) scan after the tests and uploads Jest coverage (`coverage/lcov.info`). Configuration lives in `sonar-project.properties`. Fix new issues reported on your PR before merging.

The scan waits for the quality gate (`sonar.qualitygate.wait`): a failing gate fails the required **Lint, typecheck & test** check. On a PR the gate only judges the lines the PR changes; on `main` it judges all new code. The scan is skipped when `SONAR_TOKEN` isn't available (Dependabot and fork PRs).

Import images through `src/lib/assets.ts` (relative paths), not with `@/assets/…`: Sonar can't resolve that alias to an image file and reports it as an undeclared package (S4328).

## Dependency updates

Dependabot opens grouped update PRs weekly, only for versions **published at least 7 days ago** (`cooldown` in `.github/dependabot.yml`). The same rule is **enforced locally and in CI** by `min-release-age=7` in `.npmrc`: `npm install` / `npx expo install` pick the newest version that is at least 7 days old. `engines.npm >= 11.10.0` + `engine-strict` make older npm versions (which would silently ignore the setting) fail. Dependabot security updates are not delayed.

`npm run doctor` runs `expo-doctor` without its online dependency check (it demands Expo's latest patches, which the 7-day rule refuses for a week) and `scripts/check-expo-dependencies.mjs` instead: installed Expo SDK packages must match the ranges of the **installed** `expo` package (`bundledNativeModules.json`), so wrong SDK or minor versions still fail.

## Upgrading the Expo SDK

Dependabot does not propose Expo SDK majors, nor majors of the toolchain coupled to the SDK (TypeScript — minors too, `typescript-eslint` caps it — and Jest). Upgrade them together in a dedicated PR:

```bash
npx expo install expo@^<next> --fix
npx expo-doctor
```

Then bump `typescript`, `jest` and `@types/jest` to the versions the new `jest-expo` / `eslint-config-expo` support, read the SDK changelog and test on a device.
