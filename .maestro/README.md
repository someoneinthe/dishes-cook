# End-to-end tests (Maestro)

[Maestro](https://maestro.dev) flows that drive the real app on an Android emulator: what used to be checked by hand before a PR. Unit, screen and sync tests stay in Jest; these flows check that the pieces work together on a device.

| Flow           | Checks                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `recipes.yaml` | Add a recipe with a new ingredient, edit it (with a quantity in grams), find it in Meal choice and in Recipes, delete it after confirming. |
| `sync.yaml`    | Connect to a sync server (the first sync merges the phone's recipes and the server's), then a deletion reaches the server.                 |

`subflows/` holds steps shared by flows; `scripts/server.js` reads and writes the test sync server directly, as another phone would.

## Running them

They run on **a release build made for them**: its JavaScript is bundled (Maestro hangs now and then on a debug build that loads it from Metro), and `E2E_BUILD=1` lets it reach the test sync server over plain HTTP (`plugins/with-e2e-cleartext.js`; the released app never can).

1. Install Maestro (`brew install mobile-dev-inc/tap/maestro`, which needs Java 17: `brew install openjdk@17`) and boot an Android emulator.
2. Build and install the end-to-end build, for the emulator's processor (arm64 on Apple silicon, x86_64 on Intel and in CI):
   ```bash
   E2E_BUILD=1 npx expo prebuild --platform android --clean
   abi=arm64-v8a   # the emulator's processor: arm64-v8a on Apple silicon, x86_64 on Intel
   (cd android && ./gradlew assembleRelease -PreactNativeArchitectures="$abi")
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```
   Run `npx expo prebuild --platform android --clean` again (without `E2E_BUILD`) before going back to debug builds.
3. `npm run test:e2e` runs every flow; `npm run test:e2e -- .maestro/sync.yaml` runs one. It starts a throwaway PocketBase with a throwaway account (`scripts/pocketbase-server.sh`, as for `npm run test:pocketbase`) and forwards its port to the emulator (`adb reverse`). Set `ANDROID_SERIAL` when several devices are connected: both adb and Maestro then use that one. It stops at the first failure; two options come before the flows:
   - `--output-dir <dir>` keeps Maestro's JUnit report, screenshots and logs (and the emulator's log, `logcat.txt`, when a flow fails) in `<dir>/attempt-1`.
   - `--retry` (what CI runs) runs the flows that failed once more, in `<dir>/attempt-2`, on a new throwaway server (`sync.yaml` adds a recipe with a fixed id to it). The tests fail only if a flow fails twice; one that passes the second time prints a warning. The flows to run again come from the report (`scripts/e2e-failed-flows.mjs`, all of them when it can't tell).

Each flow starts with `launchApp: clearState`: it wipes the app's data on that emulator.

Maestro's anonymous analytics are turned off (`MAESTRO_CLI_NO_ANALYTICS`).

## In CI

The **End-to-end tests** job of `ci.yml` builds the x86_64 end-to-end APK, boots an emulator and runs `npm run test:e2e`, with the Maestro version in `maestro-version` (downloaded from its release and checked against the release's checksums). It runs on `main` and on PRs that change the app (`src/`, `assets/`, `plugins/`, `app.config.ts`, dependencies, `server/`, these flows), not on docs-only or CI-only PRs. It takes about 20 minutes.

CI's x86_64 emulator crashes now and then (in October 2026, 8 of the last 40 failed CI runs): the app killed at launch right after `clearState`, or a native SIGSEGV in GWP-ASan's backtrace during a Hermes free. So the job runs `npm run test:e2e -- --retry`: a flow that fails runs once more, and fails the job only if it fails again. A flow that passes on the retry leaves a **Flaky end-to-end flow** warning on the workflow run, and the screenshots and logs of both runs in its `maestro-output` artifact (kept too when a flow fails twice): look at them when the warning shows up often. The retry is for the emulator's crashes only: a flow that fails because something is hidden or out of reach fails twice, and it's an app bug to fix (see below).

## Writing flows

- Find elements by their visible text or accessibility label (the English UI: the emulator's language), never by coordinates. A label shown above a field matches too: tap the field by its placeholder, or with `index: 1`.
- The keyboard covers the lower part of the screen, but Maestro still sees the fields behind it: close it (`hideKeyboard`) and `scrollUntilVisible` a field before tapping it. CI's emulator has a Pixel 6 screen.
- Only type in **empty** fields: on a field that already has text, Maestro waits for the screen to settle and never returns.
- Wait for what a step leads to (`extendedWaitUntil`) rather than a fixed delay.
- A step that fails because something is hidden or out of reach (behind the keyboard, off screen) usually shows an app bug: fix the app rather than the flow.
