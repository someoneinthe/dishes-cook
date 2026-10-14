---
name: new-feature
description: Scaffold a new feature in the dishes-cook app (feature folder, screen, thin Expo Router route, colocated test). Use when the user asks to add a screen, page or feature such as "add a recipe list screen" or "create the picker feature".
argument-hint: <feature-name> [route-path]
---

Scaffold the feature `$ARGUMENTS` following `docs/tech-stack.md` and `CONTRIBUTING.md`.

1. Derive a kebab-case feature name (e.g. `recipe-list`) and, if not given, a route path (e.g. `src/app/recipes/index.tsx`). Ask only if the route is genuinely ambiguous.
2. Create:
   - `src/features/<feature>/<feature>-screen.tsx` — named export `<Feature>Screen`, Unistyles `StyleSheet.create((theme) => …)` using theme tokens (no raw colors), accessible labels on touchables. Buttons follow CONTRIBUTING › Buttons: `Button` (blue primary, red `danger` with a trash icon for deletions, outlined `secondary`), icon only (`isIconOnly`) when the icon is self-explanatory, and the screen's actions in the header (`headerRight` with `HeaderActions`). Every text shown to users comes from `useMessages()`: add the entries to `src/i18n/en.ts` and `src/i18n/fr.ts`. A deletion asks first with `useConfirmDelete`.
   - `src/features/<feature>/<feature>-screen.test.tsx` — React Native Testing Library test querying by visible text/role; mock `expo-router` only if the screen uses it.
   - For user-facing behaviour: `src/features/<feature>/<feature>.feature` (Gherkin scenarios) + `<feature>.steps.test.tsx` (jest-cucumber step definitions), see `src/features/loading/`. The scenarios are also the app's feature list: run `npm run docs:features` to regenerate `docs/features.md` (CI checks it).
   - The route file under `src/app/` containing only `export { <Feature>Screen as default } from '@/features/<feature>/<feature>-screen';`
   - Subfolders (`components/`, `hooks/`, `db/`) only when the feature actually needs them.
3. If the screen needs a layout change (tabs, stack options), edit the nearest `_layout.tsx`.
4. Never put tests or helpers inside `src/app/` (every file there becomes a route).
5. Run `npm run check` and fix anything it reports.
6. Suggest a Conventional Commit / PR title, e.g. `feat(<feature>): add <feature> screen`.
