# Dishes Cook

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=someoneinthe_dishes-cook&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=someoneinthe_dishes-cook)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=someoneinthe_dishes-cook&metric=coverage)](https://sonarcloud.io/summary/new_code?id=someoneinthe_dishes-cook)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=someoneinthe_dishes-cook&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=someoneinthe_dishes-cook)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=someoneinthe_dishes-cook&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=someoneinthe_dishes-cook)
[![CI](https://github.com/someoneinthe/dishes-cook/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/someoneinthe/dishes-cook/actions/workflows/ci.yml)

> [!NOTE]
> **Built with AI.** This repository is created and maintained with AI: code, configuration, CI and documentation are written by [Claude Code](https://claude.com/claude-code) (Anthropic), under the direction and review of the repository owner. Eligible pull requests (not drafts or bot PRs) are also reviewed automatically by [CodeRabbit](https://www.coderabbit.ai/).

Mobile app that helps you decide what to eat, picking from the recipes you've saved.

Android first (iOS later, same codebase); the same app runs on Android TV, read-only, to pick and show recipes on the big screen, and in a desktop browser, served by the sync server ([web app](docs/sync.md#web-app)). Built with Expo + React Native + TypeScript. Data lives on the device; it can optionally be synced with your own self-hosted [PocketBase](https://pocketbase.io) server to share recipes between phones ([how](docs/sync.md)).

What it does, screen by screen: [Features](docs/features.md).

## Install

On your Android phone (or TV), download `dishes-cook-vX.Y.Z.apk` from the [latest release](https://github.com/someoneinthe/dishes-cook/releases/latest) and open it: Android asks once to let your browser install apps. A new version installs the same way, over the previous one, keeping your recipes.

## Getting started

Prerequisites:

- Node 24 with npm ≥ 11.10 (`nvm use`)
- For native builds: Android Studio (SDK + an emulator, or a device with USB debugging) and **JDK 17**

> **Use JDK 17, not Android Studio's bundled JDK.** Android Studio ships JDK 25, and with it the native (CMake) build fails with `A restricted method in java.lang.System has been called`. Point `JAVA_HOME` at a JDK 17, e.g. `export JAVA_HOME=$(/usr/libexec/java_home -v 17)` (or the one Gradle downloads under `~/.gradle/jdks/`).

```bash
npm install
npm run android     # build & install the development build, then start Metro (Expo Go is not supported)
npm start           # later: dev server only, press "a" to open the installed development build
```

The first native build downloads the Android NDK, SDK platform and build-tools (several GB, ~30 min); rebuilds take ~2–3 min and JS changes reload instantly. To pick a specific emulator, pass its AVD name: `npx expo run:android --device Pixel_9a`.

## Scripts

| Script                            | What it does                                    |
| --------------------------------- | ----------------------------------------------- |
| `npm start`                       | Metro dev server                                |
| `npm run android`                 | Native development build on Android             |
| `npm run web` / `web:export`      | The web app: dev server / static export         |
| `npm run lint` / `lint:fix`       | ESLint (eslint-config-expo + project rules)     |
| `npm run format` / `format:check` | Prettier                                        |
| `npm run typecheck`               | `tsc --noEmit`                                  |
| `npm test` / `test:ci`            | Jest (jest-expo + React Native Testing Library) |
| `npm run doctor`                  | expo-doctor: SDK/dependency consistency         |
| `npm run check`                   | lint + format check + typecheck + tests         |

## Docs

- [Features](docs/features.md): what the app does, generated from the behaviour specs
- [Tech stack & decisions](docs/tech-stack.md)
- [Database](docs/database.md): schema, indexes, migrations
- [Server sync](docs/sync.md): how phones sync with a PocketBase server, and how to set one up
- [Contributing: workflow & conventions](CONTRIBUTING.md)
- [Release process](docs/release.md)

## License

[MIT](LICENSE) © Florian Casset
