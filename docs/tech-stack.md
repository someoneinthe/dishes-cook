# Tech stack & decisions

| Concern            | Choice                                                                                                                                                                                         | Why                                                                                                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | **Expo SDK 57** + React Native 0.86 (New Architecture)                                                                                                                                         | One TypeScript codebase for Android now and iOS later; managed native config (CNG).                                                                                                                           |
| Language           | **TypeScript** (strict, `noUncheckedIndexedAccess`)                                                                                                                                            | Type safety; same language as the tooling.                                                                                                                                                                    |
| Navigation         | **Expo Router** (file-based, typed routes)                                                                                                                                                     | Expo default; deep links for free.                                                                                                                                                                            |
| Local storage      | **expo-sqlite** + **Drizzle ORM** — see [database.md](database.md)                                                                                                                             | Relational data (recipes ↔ ingredients ↔ tags), typed queries, versioned migrations, live queries.                                                                                                            |
| Small key/value    | expo-sqlite `kv-store` (user preferences: `src/features/settings/preferences.ts`) or `expo-secure-store` for secrets                                                                           | Avoid an extra dependency for preferences.                                                                                                                                                                    |
| Data fetching      | **TanStack Query** over the local database                                                                                                                                                     | Caching, pagination (`useInfiniteQuery`, pages of 50) and invalidation after writes; the same hooks will work against an API later.                                                                           |
| UI state           | React state/context; Zustand only if it gets complex                                                                                                                                           | Global UI state is small.                                                                                                                                                                                     |
| Styling            | **Unistyles 3** (`react-native-unistyles` + `react-native-nitro-modules`)                                                                                                                      | `StyleSheet`-compatible, light/dark themes via tokens, computed natively (no runtime class parsing), React Compiler friendly. No component kit: own small components. Needs a development build (no Expo Go). |
| Compiler           | React Compiler (enabled)                                                                                                                                                                       | Automatic memoization; avoid manual `useMemo`/`useCallback` unless measured.                                                                                                                                  |
| Lint / format      | ESLint 10 flat config (`eslint-config-expo` + typescript-eslint type-aware, unicorn, sonarjs, perfectionist, react-native, @react-native, react-native-a11y, jest, testing-library) + Prettier | Same plugin family as the SPA; Prettier owns formatting, ESLint owns correctness. See CONTRIBUTING › Linting.                                                                                                 |
| Tests              | Jest + `jest-expo` + React Native Testing Library                                                                                                                                              | Standard for Expo; test behaviour, not implementation.                                                                                                                                                        |
| Behaviour specs    | Gherkin `.feature` files run by jest-cucumber in Jest                                                                                                                                          | Readable scenarios for user-facing behaviour, same runner/mocks as unit tests.                                                                                                                                |
| E2E (later)        | Maestro                                                                                                                                                                                        | YAML flows, easy on Android emulators in CI. Add once there are real user flows.                                                                                                                              |
| Security scanning  | CodeQL (JS/TS + Actions) + Dependency review                                                                                                                                                   | Code scanning on every PR/weekly; PRs adding vulnerable or GPL deps are blocked.                                                                                                                              |
| Code quality       | SonarQube Cloud (free for public repos)                                                                                                                                                        | Coverage, smells, duplication and PR decoration on top of ESLint/TypeScript.                                                                                                                                  |
| Git hooks          | Husky + lint-staged + commitlint                                                                                                                                                               | Fast feedback before CI.                                                                                                                                                                                      |
| CI/CD              | GitHub Actions                                                                                                                                                                                 | Checks on every PR, Android build when native inputs change, release on merge.                                                                                                                                |
| Release            | release-please + Gradle build on CI → signed APK on GitHub Releases                                                                                                                            | No store, no paid service; versions and changelog derived from commits.                                                                                                                                       |
| Dependency updates | Dependabot (weekly, grouped)                                                                                                                                                                   | Expo SDK majors are upgraded manually with `npx expo install --fix`.                                                                                                                                          |

## Project structure

```
src/
  app/            # Expo Router routes ONLY — thin files that re-export screens
  features/       # one folder per feature (recipes, picker, …)
    <feature>/
      <name>-screen.tsx
      components/
      hooks/
      db/         # queries for this feature
      *.test.ts(x) colocated with the code
  components/     # shared, feature-agnostic UI
  db/             # Drizzle schema, client, migrations, live queries
  lib/            # shared utilities
  test/           # test helpers (in-memory database, alert spy)
assets/           # icons, splash, fonts
```

Every file inside `src/app/` becomes a route, so tests and helpers must never live there.

## Native code

`android/` and `ios/` are generated by `npx expo prebuild` (Continuous Native Generation) and are git-ignored. Configure native behaviour through `app.config.ts` and config plugins, never by editing generated folders.

## Identifiers

- Android package / iOS bundle id: `io.github.someoneinthe.dishescook` — **cannot change after the first public release** (users couldn't upgrade).
- Version: `package.json` `version` is the source of truth; `versionCode` is derived as `major*1_000_000 + minor*1_000 + patch`.
