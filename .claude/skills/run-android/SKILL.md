---
name: run-android
description: Build, install and run the dishes-cook app on an Android emulator (or device), then screenshot and inspect it. Use when asked to run, launch, start or screenshot the app, or to check a change on Android.
---

Verified on macOS with Android Studio installed. Run from the repo root.

## 1. Pick an emulator and boot it

```bash
SDK=~/Library/Android/sdk
$SDK/emulator/emulator -list-avds                     # e.g. Pixel_9a
$SDK/emulator/emulator -avd Pixel_9a -no-snapshot-save -no-boot-anim   # run in background
# wait for boot
until [ "$($SDK/platform-tools/adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 2; done
```

## 2. Use JDK 17 (not Android Studio's JDK 25)

With Android Studio's bundled JDK 25, `configureCMakeDebug` fails with
`WARNING: A restricted method in java.lang.System has been called`. Find a JDK 17:

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null) \
  || JAVA_HOME=$(find ~/.gradle/jdks -maxdepth 4 -type d -path "*jdk-17*/Contents/Home" 2>/dev/null | head -1)
```

If a Gradle daemon was started with another JDK, stop it first: `(cd android && ./gradlew --stop)`.

## 3. Build and install (native changes only)

```bash
export JAVA_HOME ANDROID_HOME=~/Library/Android/sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
CI=1 npx expo run:android --device Pixel_9a --no-bundler > run-android.log 2>&1
```

- `--device` takes the **AVD name** (`Pixel_9a`), not the adb serial (`emulator-5554`).
- `--no-bundler`: Metro is started separately in step 4 (`CI=1` is fine for the build, not for Metro).
- First build: ~30 min (downloads NDK, SDK platform, build-tools). Rebuilds: ~2–3 min.
- Done when the log shows `BUILD SUCCESSFUL`. Watch for `BUILD FAILED`, `What went wrong`, `CommandError`.
- Rebuild only after native changes (dependencies with native code, `app.config.ts`, assets used by the native splash). If the app is missing from the emulator but nothing native changed, reinstall the last build on the emulator (serial from `adb devices`, e.g. `emulator-5554`): `adb -s emulator-5554 install -r android/app/build/outputs/apk/debug/app-debug.apk`. With several devices connected, every `adb` command needs `-s <serial>`.

## 4. Start Metro in watch mode, then open the app

**Never start Metro with `CI=1`**: it disables file watching ("Metro is running in CI mode, reloads are disabled"), so the app keeps running the code Metro saw at startup and your edits never reach it.

```bash
npx expo start --dev-client < /dev/null > metro.log 2>&1 &   # background, non-interactive, still watches files
until grep -q "Waiting on" metro.log; do sleep 1; done
ADB=~/Library/Android/sdk/platform-tools/adb
$ADB shell am force-stop io.github.someoneinthe.dishescook
$ADB shell am start -a android.intent.action.VIEW \
  -d "dishescook://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"
```

Done when `metro.log` shows `Android Bundled … index.ts`. Runtime errors show up there as `ERROR` with a code frame.

**Check that your edit is actually served.** Without [watchman](https://facebook.github.io/watchman/) (`brew install watchman`), Metro's fallback file watcher can miss edits. Look for a snippet of the new code in the served bundle:

```bash
curl -s "http://localhost:8081/.expo/.virtual-metro-entry.bundle?platform=android&dev=true&minify=false" | grep -c "<snippet>"
```

If it's not there, restart Metro (`pkill -f "expo start"`, then the commands above). A red-box code frame that doesn't match the source line is another sign of a stale bundle.

**Stopping Metro without killing the emulator**:

- Don't kill whatever listens on port 8081 (`lsof -ti tcp:8081 | xargs kill`): the emulator holds connections on that port and gets killed too.
- Stop Metro with `pkill -f "expo start"`. Never put that string in the command line that launches the emulator, or `pkill` kills it as well.

## 5. Drive and check it

```bash
ADB=~/Library/Android/sdk/platform-tools/adb
$ADB exec-out screencap -p > screen.png                 # then look at the image
$ADB shell uiautomator dump /sdcard/ui.xml && $ADB shell cat /sdcard/ui.xml   # view hierarchy
$ADB logcat -d -s ReactNativeJS | tail -50              # console.log/warn/error from JS
```

- **Tap elements by their accessibility label**, not by coordinates guessed from a screenshot. Find the element in the `uiautomator` dump and tap the center of its `bounds`. Match on `content-desc` first: a field's visible label is a separate `Text` node with the same `text`.
- **The keyboard can hide elements.** An element behind the keyboard is still in the dump, and tapping its bounds hits a key instead. Close the keyboard first.
- **Typing**: `$ADB shell input text "Pumpkin%ssoup"` (`%s` = space). `$ADB shell input keyevent 66` = Enter.
- **Close the keyboard with `input keyevent 111` (Esc), not Back (`4`)**: when the keyboard is already closed, Back leaves the screen.

Expected startup: native splash (plate on white / `#121212` in dark mode) → full illustration (~1.5 s) → home screen. The illustration is short: take screenshots in a quick loop to catch it.

## Troubleshooting

- **Blank/black screen, `splashscreen_icon_view` still in the view hierarchy**: the native splash is never hidden; JS errors are hidden behind it, so check `metro.log` and `logcat`.
- **Edits don't show up**: see step 4 (`CI=1`, file watcher, stale bundle).
- **`adb: device offline`, or the emulator rebooted**: wait for `sys.boot_completed` again (step 1), then reopen the app (step 4).
- **Theme check**: `$ADB shell cmd uimode night yes|no` toggles dark mode live.
