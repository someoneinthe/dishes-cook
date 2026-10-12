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

## 3. Build, install and start Metro

```bash
export JAVA_HOME ANDROID_HOME=~/Library/Android/sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
CI=1 npx expo run:android --device Pixel_9a > run-android.log 2>&1   # run in background; keeps Metro running
```

- `--device` takes the **AVD name** (`Pixel_9a`), not the adb serial (`emulator-5554`).
- First build: ~30 min (downloads NDK, SDK platform, build-tools). Rebuilds: ~2–3 min.
- Done when the log shows `Android Bundled … index.ts`. Watch for `BUILD FAILED`, `What went wrong`, `CommandError`, `Bundling failed`.

## 4. Drive and check it

```bash
ADB=~/Library/Android/sdk/platform-tools/adb
$ADB exec-out screencap -p > screen.png                 # then look at the image
$ADB shell uiautomator dump /sdcard/ui.xml && $ADB shell cat /sdcard/ui.xml   # view hierarchy
$ADB logcat -d --pid=$($ADB shell pidof io.github.someoneinthe.dishescook) | tail -50
# relaunch the dev build against the running Metro
$ADB shell am force-stop io.github.someoneinthe.dishescook
$ADB shell am start -a android.intent.action.VIEW \
  -d "dishescook://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"
```

Expected startup: native splash (plate on white / `#121212` in dark mode) → full illustration (~1.5 s) → home screen ("What should we eat today?"). The illustration is short: take screenshots in a quick loop to catch it.

JS changes hot-reload through Metro: no rebuild needed. Rebuild (step 3) only after native changes (dependencies with native code, `app.config.ts`, assets used by the native splash).

## Troubleshooting

- **Blank/black screen, `splashscreen_icon_view` still in the view hierarchy**: the native splash is never hidden; JS errors are hidden behind it, so check the Metro log and `logcat`.
- **Theme check**: `$ADB shell cmd uimode night yes|no` toggles dark mode live.
