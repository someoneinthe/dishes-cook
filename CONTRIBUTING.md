# Contributing

## Workflow

1. Branch from `main`: `feat/<short-topic>`, `fix/<short-topic>`, `chore/<short-topic>`.
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/) — enforced by commitlint in the `commit-msg` hook.
3. Open a PR **assigned to yourself** (`gh pr create --assignee @me`). Its **title must be a Conventional Commit** (checked in CI) because PRs are **squash-merged** and the title becomes the commit on `main`.
4. **Every CI job must complete successfully** before merging (enforced by the `main` ruleset): lint, format, typecheck, tests, expo-doctor, SonarQube Cloud, CodeQL, dependency review, and the Android build when dependencies, `app.config.ts` or assets change. See [the required checks](docs/release.md#1-repository-settings-already-applied).
5. Keep the branch up to date by **rebasing, never merging** `main` into it: `git rebase origin/main` then `git push --force-with-lease` (or `gh pr update-branch --rebase`). History on branches stays linear.
6. Squash-merge. Never push directly to `main`.

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
- **Styling**: `StyleSheet.create`, theme tokens in one place; support light and dark mode.
- **Tests**: colocated `*.test.ts(x)`; query by what the user sees (`getByText`, `getByRole`), not test IDs, when possible. Pure logic (e.g. the "what to eat" picker) gets unit tests.
- **Accessibility**: every touchable has an accessible label/role.
- Run `npm run check` before pushing.

## Linting

`eslint.config.mjs` (ESLint 10, flat config) follows the SPA's rule set, adapted to React Native. On top of `eslint-config-expo`:

- **typescript-eslint** type-aware rules (floating/misused promises, unsafe `any`…) and the SPA's `naming-convention`: booleans start with `is`/`can`/`will`/`should`/`has`, arrays end with `List`, types are PascalCase, enum members UPPER_CASE
- Core rules: `curly`, `complexity` (12), `arrow-body-style`, `object-shorthand`, `prefer-template`; unused `eslint-disable` comments are errors
- **unicorn** (tuned like the SPA), **sonarjs**, **perfectionist** (natural sorting of imports, objects, JSX props…), **unused-imports** (auto-removed on `--fix`)
- **react-you-might-not-need-an-effect** (strict) and **react-native** (`no-unused-styles`, `no-inline-styles`, `no-color-literals`)
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

The scan is skipped when `SONAR_TOKEN` isn't available (Dependabot and fork PRs).

## Dependency updates

Dependabot opens grouped update PRs weekly, only for versions **published at least 7 days ago** (`cooldown` in `.github/dependabot.yml`). The same rule is **enforced locally and in CI** by `min-release-age=7` in `.npmrc`: `npm install` / `npx expo install` pick the newest version that is at least 7 days old. `engines.npm >= 11.10.0` + `engine-strict` make older npm versions (which would silently ignore the setting) fail. Dependabot security updates are not delayed.

## Upgrading the Expo SDK

Dependabot does not propose Expo SDK majors, nor majors of the toolchain coupled to the SDK (TypeScript — minors too, `typescript-eslint` caps it — and Jest). Upgrade them together in a dedicated PR:

```bash
npx expo install expo@^<next> --fix
npx expo-doctor
```

Then bump `typescript`, `jest` and `@types/jest` to the versions the new `jest-expo` / `eslint-config-expo` support, read the SDK changelog and test on a device.
