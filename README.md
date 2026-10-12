# Dishes Cook

> [!WARNING]
> **Draft project — not usable yet.** Only the project foundations (tooling, CI, release pipeline) exist; the app has no features so far.

> [!NOTE]
> **Built with AI.** This repository is created and maintained with AI: code, configuration, CI and documentation are written by [Claude Code](https://claude.com/claude-code) (Anthropic), under the direction and review of the repository owner. Pull requests are also reviewed by [CodeRabbit](https://www.coderabbit.ai/).

Mobile app that helps you decide what to eat, picking from the recipes you've saved.

Android first (iOS later, same codebase). Built with Expo + React Native + TypeScript. Data stays on the device.

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

## License

[MIT](LICENSE) © Florian Casset
