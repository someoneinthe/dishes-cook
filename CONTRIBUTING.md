# Contributing

## Workflow

1. Branch from `main`: `feat/<short-topic>`, `fix/<short-topic>`, `chore/<short-topic>`.
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/) — enforced by commitlint in the `commit-msg` hook.
3. **Check user-facing changes end to end on a phone and on an Android TV** before opening the PR, each on an emulator or a real device (`npm run android`, or `/run-android` in Claude Code): go through the flows you changed, not only the launch; on the TV, with the remote's D-pad only. Tests run on Node, not on Hermes, the engine the app runs on, so they can pass while the app crashes.
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
- **Behaviour specs (Gherkin)**: describe user-facing behaviour as scenarios in `<name>.feature` (plain English, no implementation details), next to `<name>.steps.test.tsx`, which implements the steps with [jest-cucumber](https://github.com/bencompton/jest-cucumber) (`loadFeature` + `defineFeature`) and React Native Testing Library. Feature and step files must match: a scenario or step without code fails the run with a suggested snippet. Reuse step functions across scenarios; keep low-level cases in regular `*.test.tsx`. Example: `src/features/loading/loading-screen.feature`. The scenarios are also the app's feature list: `npm run docs:features` regenerates `docs/features.md` from them (CI fails if it's out of date, and each release carries it).
- **Accessibility**: every touchable has an accessible label/role. Text scales with the phone's font size: sizes come from `theme.typography` (dp, scaled by React Native), never `allowFontScaling={false}`; containers use `minHeight`, rows wrap rather than squeeze text, and icons use `useIconSize`. Check screens at a 1.3× and 2× system font size.
- **The About page tells people where their data goes** (menu › About): what stays on the device, what goes to their own sync server and that nothing reaches anyone else. Its text is `about` in `src/i18n/en.ts` and `fr.ts`, the one place to keep true: a change to what the app stores or sends (a new network call or synced field, a library that reports to its vendor, analytics, Android backup rules) updates it, in every language, in the same PR. Today Android's Auto Backup only includes shared preferences (the backup rules of `expo-secure-store`, which also leave out its token), so the database isn't backed up.
- **Sorting, filtering, ordering in the data layer only**: done in SQL by the query functions (`src/features/*/db`), later by the API, never in screens, hooks or components (no `.sort()` / `.filter()` / search on fetched rows). Text sorts and searches on `sort_key` columns (no case, no accents), since SQLite can't fold accents.
- **Lists**: a query never returns more than 50 rows (`PAGE_SIZE`). Long lists page with `usePagedQuery` (keyset pagination on a `(sort_key, id)` index, infinite scroll, at most `MAX_PAGES` pages in memory); short ones (suggestions) use `LIMIT`. Count, filter and pick in SQL rather than loading rows to do it in JS. Screens read data with TanStack Query hooks (`src/features/*/hooks`, built on `useLocalQuery` and `usePagedQuery`); every write made through Drizzle invalidates them.
- **Buttons**: always the `Button` component. Primary action (`variant="primary"`, default): blue (`actionPrimary`), white text (`onAction`). Deletion (`variant="danger"`): red (`actionDanger`), white text, always an icon (`trash-can-outline`, required by the types). Other actions: `variant="secondary"` (outlined); `variant="active"` (light blue tint, blue icon and border) when such a button's option is on, e.g. Filters while filters apply. Show **only the icon** (`isIconOnly`; the `label` is still read by screen readers) when it's self-explanatory: add, edit, delete, save, cancel. Keep **icon + text**, or text only, when the icon alone isn't enough. Whether an icon-only button shows its text is `Button`'s decision (Settings › "Show button labels", and always in a ⋮ menu): screens never show or hide labels themselves. When the right look, place or icon isn't clear, ask the maintainer before building it. A screen's actions go in its **header, top right** (`headerRight` + `HeaderActions`); when there are many, the less used ones go in `headerActions(buttons, more)`'s `more`, shown in a ⋮ menu when the header has no room (button labels, a large font), so the back button and title stay visible; a recipe's page puts them all in the ⋮ menu, labeled (`headerMenu(buttons)`). Actions on one list row stay in the row. Icons: `src/components/icon.tsx`, Material Design Icons in a font cut down to the icons the app uses (`assets/fonts/app-icons.ttf`, 7 KB instead of 1.3 MB): add one with `npm run icons -- add <name>` (the name from [pictogrammers.com](https://pictogrammers.com/library/mdi/), without `mdi-`), which also makes it a valid `IconName`; `npm run docs:check` (CI) checks the font matches the list. Native confirmation dialogs (`Alert`) can't be styled.
- **Deleting**: every deletion (recipe, ingredient, anything added later) asks first, through `useConfirmDelete` (`src/components/use-confirm-delete.ts`): "Delete “name”?", an optional message on the consequences, Cancel and a red Delete. ESLint refuses destructive dialog buttons anywhere else.
- **Text shown to users is translated** (English and French today): it comes from the dictionaries in `src/i18n/` (`en.ts` is the reference, `fr.ts` must define the same entries: TypeScript checks it), read with `useMessages()`. Texts with a name or a count are functions (`t.recipes.ingredientCount(n)`), so each language handles its own plurals and word order. Labels, hints, placeholders and messages count, screen-reader text included; user content (recipe titles, ingredients) is never translated. ESLint flags text written anywhere else in `src/`: JSX text and user-facing props (`i18next/no-literal-string`), and with `no-restricted-syntax` dialog text (`Alert.alert`), user-facing properties in plain objects (option `label`s, navigation `title`s, button `text`…), sentences (two words or more) and template strings with words. Errors and logs for developers, SQL and single-word values (icons, routes, option values) are not flagged. French typography: a narrow no-break space (`\u202F`) before `?`, `!` and `:`, « » quotes.
- `npm run check` runs before every push (`.husky/pre-push`, about 25 s): lint without warnings, formatting, the generated docs (`docs:check`), types, tests with coverage (`test:coverage`), and the coverage of the lines the branch changes (`coverage:new`, below), as CI does. `git push --no-verify` skips it.

## Linting

`eslint.config.mjs` (ESLint 10, flat config) follows the SPA's rule set, adapted to React Native. On top of `eslint-config-expo`:

- **typescript-eslint** full `recommendedTypeChecked` preset (recommended + type-aware rules: floating/misused promises, unsafe `any`, `ban-ts-comment`…) and the SPA's `naming-convention`: booleans start with `is`/`can`/`will`/`should`/`has`, arrays end with `List`, types are PascalCase, enum members UPPER_CASE
- Core rules: `curly`, `complexity` (12), `arrow-body-style`, `object-shorthand`, `prefer-template`; unused `eslint-disable` comments are errors
- **unicorn** (tuned like the SPA), **sonarjs**, **perfectionist** (natural sorting of imports, objects, JSX props…), **unused-imports** (auto-removed on `--fix`)
- **react-you-might-not-need-an-effect** (strict) and **react-native** (`no-raw-text`, `no-unused-styles`, `no-inline-styles`, `no-color-literals`, `no-single-element-style-arrays`)
- **@react-native/eslint-plugin** (official, versioned with `react-native`): `no-deep-imports`, `platform-colors`; and `expo/prefer-box-shadow` (cross-platform `boxShadow` instead of `elevation` / `shadow*`)
- **react-native-a11y** (`android` preset; switch to `all` when iOS is added): valid accessibility roles/states/values, no nested touchables
- **i18next** (`no-literal-string`, library-agnostic: the app uses its own dictionaries): no text written in JSX or in the props users see or hear (`label`, `accessibilityHint`, `placeholder`…); and `no-restricted-syntax` rules: no untranslated text in dialogs, option lists, navigation options, helper sentences or template strings, and destructive dialog buttons only in `useConfirmDelete`
- Tests: **jest** (`all`, with the SPA's exceptions) and **testing-library**
- **eslint-config-prettier** last (Prettier owns formatting)

React Native specifics:

- unicorn rules that push APIs Hermes / React Native lack (`structuredClone`, `Blob#text()`, `URL.canParse`, `AbortSignal.any`, top-level `await`…) are off. Iterator helpers, Set methods and `Promise.withResolvers` are off until verified on a device.
- `sonarjs/pseudo-random` is off: picking a random recipe is the app's purpose.
- In the app's code (not tests), the rules SonarQube Cloud checks are on, since its quality gate fails CI on any new issue: `no-await-in-loop`, `no-continue` and `sonarjs/nested-control-flow` (3 levels) in `eslint.config.mjs`, and the others in `eslint.sonar-rules.json`, generated from its quality profile (see Code quality below). Run requests of a page side by side (`settleAll`); a loop that must wait (pages read one after another from a cursor) says why in its `eslint-disable-next-line`.
- `unicorn/filename-case` is kebab-case (`_layout.tsx` excepted), not the SPA's camel/Pascal case.

`eslint-plugin-react` and `eslint-plugin-import` (bundled by Expo), `eslint-plugin-react-native` and `eslint-plugin-react-native-a11y` don't declare ESLint 10 support yet: npm `overrides` in `package.json` let them install with our ESLint, and `@eslint/compat` shims the APIs ESLint 10 removed. Drop both workarounds once those plugins support ESLint 10.

Two more `overrides` pull patched versions of vulnerable transitive dev dependencies: `uuid` (≥ 11.1.1, used by `xcode` and `jest-cucumber`) and the `esbuild` of `@esbuild-kit/core-utils` (≥ 0.25, used by `drizzle-kit`). Drop them once those packages depend on fixed versions themselves.

## Code quality (SonarQube Cloud)

CI runs a [SonarQube Cloud](https://sonarcloud.io/project/overview?id=someoneinthe_dishes-cook) scan after the tests and uploads Jest coverage (`coverage/lcov.info`). Configuration lives in `sonar-project.properties`. Fix new issues reported on your PR before merging.

The scan waits for the quality gate (`sonar.qualitygate.wait`): a failing gate fails the required **Lint, typecheck & test** check. On a PR the gate only judges the lines the PR changes; on `main` it judges all new code. The scan is skipped when `SONAR_TOKEN` isn't available (Dependabot and fork PRs).

**Its rules in ESLint**: `npm run lint:sonar-rules` reads the project's quality profile from SonarQube Cloud's public API and writes `eslint.sonar-rules.json`, the rules it checks that the rest of the ESLint config leaves off (matched by `eslint-plugin-sonarjs`), applied to the app's code. Left out: rules without an ESLint equivalent or from plugins this project doesn't use, the rules `eslint.config.mjs` turns off on purpose, the formatting rules `eslint-config-prettier` turns off, and the exceptions listed in `scripts/sonar-rules.mjs` (the rules ignored in `sonar-project.properties`, and those Sonar's own version accepts where the ESLint rule doesn't). `npm run lint:sonar-rules -- --check` tells whether the profile changed since: run it now and then, or when Sonar fails a PR on a rule `npm run lint` didn't flag. **Coverage of new code**: the quality gate wants 80 % of the lines a PR adds or changes run by the tests (lines and branches). `npm run coverage:new` measures it from Jest's report and `git diff` against where the branch left `main` (files not committed yet included), with Sonar's formula, and lists the lines left out; it fails too when an app file is missing from the report (run before the file existed): a new file without a test shows up there before the push, not on the PR.

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
