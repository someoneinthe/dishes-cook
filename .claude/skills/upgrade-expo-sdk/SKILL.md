---
name: upgrade-expo-sdk
description: Upgrade the dishes-cook app to the next Expo SDK version. Use when the user asks to upgrade Expo, React Native or the SDK.
disable-model-invocation: true
---

Upgrade Expo to the next SDK major in a dedicated branch.

1. Read the current `expo` major from `package.json`. Find the next SDK and fetch its changelog / upgrade guide from https://expo.dev/changelog and https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/. Summarize breaking changes that affect this codebase before changing anything.
2. Create branch `chore/expo-sdk-<next>`.
3. Run `npx expo install expo@^<next>.0.0 --fix`, then `npx expo-doctor` and fix what it reports.
4. Apply required code/config migrations (check `app.config.ts`, `eslint.config.mjs` (and the ESLint-10 `overrides` / `@eslint/compat` workarounds — drop them if the new SDK supports ESLint 10), `jest.config.js`, `tsconfig.json`).
5. Update the SDK/React Native versions mentioned in `docs/tech-stack.md`.
6. Run `npm run check`. Remind the user to test a development build on a device (`npm run android`); the CI Android build will also run because `package.json` changed.
7. PR title: `chore(deps): upgrade to Expo SDK <next>` (or `feat!:` if user-facing behaviour changes).
