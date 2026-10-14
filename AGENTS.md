This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npm run lint                # lint
npm run typecheck           # typecheck
npm test                    # unit/component tests
npm run check               # everything CI runs (except expo-doctor)
npm run doctor              # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run `npm run check` before declaring any task done.

## Project conventions

See `CONTRIBUTING.md` (code conventions, commits) and `docs/tech-stack.md` (stack, folder structure). Key points:

- Routes in `src/app/` are thin re-exports of screens in `src/features/<feature>/`. Never put tests or helpers in `src/app/`.
- Conventional Commits; PRs are squash-merged and the PR title is the commit.
- Data is local-first (expo-sqlite + Drizzle), with an optional sync to a self-hosted PocketBase server (`docs/sync.md`).

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building & releasing

Release APKs are built on GitHub Actions with `expo prebuild` + Gradle (no EAS account). See `docs/release.md`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
