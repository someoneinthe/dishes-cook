---
name: add-dependency
description: Add an npm package to the dishes-cook Expo app the SDK-compatible way and validate it. Use whenever a new library is needed (runtime or dev).
argument-hint: <package> [--dev]
---

Add `$ARGUMENTS` to the project.

1. Check first whether an Expo module or something already installed covers the need (`npm ls`, https://docs.expo.dev/versions/latest/). If so, propose that instead and stop.
2. Check the package: maintenance (last publish), New Architecture support, Expo config plugin needs. Fetch its docs rather than relying on memory.
3. Install:
   - Runtime: `npx expo install <package>`
   - Dev: `npx expo install -- --save-dev <package>`
4. If it ships native code or a config plugin, add the plugin to `plugins` in `app.config.ts` and note that a new development build (`npm run android`) is required — Expo Go won't have it.
5. Run `npm run doctor` and `npm run check`.
6. Summarize why the dependency was added (for the PR description). Commit type: `build(deps): add <package>`.
