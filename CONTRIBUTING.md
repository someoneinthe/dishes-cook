# Contributing

## Workflow

1. Branch from `main`: `feat/<short-topic>`, `fix/<short-topic>`, `chore/<short-topic>`.
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/) — enforced by commitlint in the `commit-msg` hook.
3. Open a PR. Its **title must be a Conventional Commit** (checked in CI) because PRs are **squash-merged** and the title becomes the commit on `main`.
4. CI must be green: lint, format, typecheck, tests, expo-doctor, CodeQL, dependency review, and an Android build when dependencies, `app.config.ts` or assets change.
5. Squash-merge. Never push directly to `main`.

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

## Code quality (SonarQube Cloud)

CI runs a [SonarQube Cloud](https://sonarcloud.io/project/overview?id=someoneinthe_dishes-cook) scan after the tests and uploads Jest coverage (`coverage/lcov.info`). Configuration lives in `sonar-project.properties`. Fix new issues reported on your PR before merging.

The scan is skipped when `SONAR_TOKEN` isn't available (Dependabot and fork PRs).

## Upgrading the Expo SDK

Dependabot does not propose Expo SDK majors. Do it in a dedicated PR:

```bash
npx expo install expo@^<next> --fix
npx expo-doctor
```

Then read the SDK changelog and test on a device.
