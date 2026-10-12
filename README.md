# Dishes Cook

Mobile app that helps you decide what to eat, picking from the recipes you've saved.

Android first (iOS later, same codebase). Built with Expo + React Native + TypeScript. Data stays on the device.

## Getting started

Prerequisites: Node 24 (`nvm use`), and for native builds Android Studio with an emulator or a device with USB debugging, JDK 17.

```bash
npm install
npm start           # dev server: press "a" to open on Android (Expo Go or a dev build)
npm run android     # build & install a development build on emulator/device
```

## Scripts

| Script                            | What it does                                    |
| --------------------------------- | ----------------------------------------------- |
| `npm start`                       | Metro dev server                                |
| `npm run android`                 | Native development build on Android             |
| `npm run lint` / `lint:fix`       | ESLint (eslint-config-expo + project rules)     |
| `npm run format` / `format:check` | Prettier                                        |
| `npm run typecheck`               | `tsc --noEmit`                                  |
| `npm test` / `test:ci`            | Jest (jest-expo + React Native Testing Library) |
| `npm run doctor`                  | expo-doctor: SDK/dependency consistency         |
| `npm run check`                   | lint + format check + typecheck + tests         |

## Docs

- [Tech stack & decisions](docs/tech-stack.md)
- [Contributing: workflow & conventions](CONTRIBUTING.md)
- [Release process](docs/release.md)
