---
name: run-android
description: Build, install and run the dishes-cook app on Android phone and TV emulators (or devices), then screenshot and inspect it. Use when asked to run, launch, start or screenshot the app, or to check a change on Android: every user-facing change is checked end to end on a phone and on a TV.
---

Verified on macOS with Android Studio installed. Run from the repo root.

Every user-facing change is checked end to end on **both** a phone (steps 1–6) and a TV (step 7), each on an emulator or a real device. Report what was checked on each, and what couldn't be.

## 1. Pick an emulator and boot it

adb reads the target device from `ANDROID_SERIAL`, so commands don't fail with `more than one device/emulator` when a phone or another emulator is connected. Set it in every shell that runs `adb` (the snippets below do).

```bash
SDK=~/Library/Android/sdk
$SDK/emulator/emulator -list-avds                     # e.g. Pixel_9a
$SDK/emulator/emulator -avd Pixel_9a -no-snapshot-save -no-boot-anim   # run in background
export ANDROID_SERIAL=emulator-5554   # its serial (`adb devices`): every adb command targets it
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
- Rebuild only after native changes (dependencies with native code, `app.config.ts`, assets used by the native splash). If the app is missing from the emulator but nothing native changed, reinstall the last build: `ANDROID_SERIAL=emulator-5554 adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

## 4. Start Metro in watch mode, then open the app

**Never start Metro with `CI=1`**: it disables file watching ("Metro is running in CI mode, reloads are disabled"), so the app keeps running the code Metro saw at startup and your edits never reach it.

```bash
npx expo start --dev-client < /dev/null > metro.log 2>&1 &   # background, non-interactive, still watches files
METRO_PID=$!
# Wait up to 2 min for Metro; stop early if it exits, and show why.
for _ in $(seq 120); do
  grep -q "Waiting on" metro.log && break
  kill -0 "$METRO_PID" 2>/dev/null || break
  sleep 1
done
ADB=~/Library/Android/sdk/platform-tools/adb
export ANDROID_SERIAL=emulator-5554   # the emulator from step 1
# Open the app only if Metro is ready (no `exit`: it would close an interactive shell).
if grep -q "Waiting on" metro.log; then
  $ADB shell am force-stop io.github.someoneinthe.dishescook
  $ADB shell am start -a android.intent.action.VIEW \
    -d "dishescook://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"
else
  cat metro.log
  echo "Metro did not start: fix the error above first." >&2
fi
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
export ANDROID_SERIAL=emulator-5554   # the emulator from step 1
$ADB exec-out screencap -p > screen.png                 # then look at the image
$ADB shell uiautomator dump /sdcard/ui.xml && $ADB shell cat /sdcard/ui.xml   # view hierarchy
$ADB logcat -d -s ReactNativeJS | tail -50              # console.log/warn/error from JS (-s here is a log tag filter)
```

- **Tap elements by their accessibility label**, not by coordinates guessed from a screenshot. Find the element in the `uiautomator` dump and tap the center of its `bounds`. Match on `content-desc` first: a field's visible label is a separate `Text` node with the same `text`.
- **The keyboard can hide elements.** An element behind the keyboard is still in the dump, and tapping its bounds hits a key instead. Close the keyboard first.
- **Typing**: `$ADB shell input text "Pumpkin%ssoup"` (`%s` = space). `$ADB shell input keyevent 66` = Enter.
- **Close the keyboard with `input keyevent 111` (Esc), not Back (`4`)**: when the keyboard is already closed, Back leaves the screen.

- **Accents can't be typed** with `input text` (ASCII only), and the keyboard may capitalize the first letter of a line. A field's label is a separate text node: tap the input's own bounds (its `content-desc`).

## 6. Check themes, languages and font sizes

- **Light/dark while the app runs**: `$ADB shell cmd uimode night yes`, then `no`, without restarting the app. Also switch while the app is in the background, then bring it back. A cold start alone doesn't count: it was right while live switches lagged one step behind.
- **Font size restarts the app** (`settings put system font_scale 1.3|2.0`, back to `1.0`): after it, navigate back to the screen you were checking, and don't take it as a test of live configuration changes.
- **Language**: Settings › Language (System / English / Français). For System following the phone: `$ADB shell cmd locale set-app-locales io.github.someoneinthe.dishescook --locales fr-FR` (restarts the app; `--locales ""` to reset).
- **Server sync**: test against a throwaway PocketBase, never the user's real server: `adb reverse tcp:<port> tcp:<port>`, then connect to `http://localhost:<port>` in Settings › Data storage (plain HTTP works in debug builds only). Steps in `docs/sync.md` › Testing during development.
- **Test data is removed once the check is done**: recipes, ingredients or meals added for a test (typed in the app or inserted with `sqlite3`, see step 7) never stay, on any device or emulator. Only on one that keeps its data on the device or syncs with a throwaway PocketBase (Settings › Data storage): never on a device synced with the user's real server (the maintainer's phone is), which would send them to every phone and TV. Before the test, save the device's database as in step 7's step 1, and afterwards restore it as in its step 4: those steps work on any debug build, phone emulator or TV, whether the rows were typed in the app or inserted. A release build (`run-as` refused) can't be restored that way: add nothing there, or delete what was added in the app. If the device synced during the test, the throwaway PocketBase holds the test rows too and would send them back on the next sync: stop it and delete the data folder it was started with (`--dir`, `/tmp/pb-test/pb_data` in `docs/sync.md` › Testing during development) as well. Then check the lists, and say in the report that the test data is gone, from the device and from the throwaway server.
- **After a schema change**: restart Metro with `--clear` (it caches the inlined SQL) and reopen the app, which applies the new migration. Don't clear its data: check that the recipes from before the change are still there.

Expected startup: native splash (the plate and cutlery on the icon's blue-grey, light and dark mode) → the loading screen, the same icon larger on the same blue-grey (~1.5 s) → home screen. It's short: take screenshots in a quick loop to catch it.

## 7. Android TV (emulator; a real TV when asked)

The same APK runs on Android TV, read-only (`isTv`), driven with the D-pad. Check TV-facing changes on the TV emulator: it's enough for most changes. Use the real TV only when the maintainer asks, or for what the emulator can't show (launcher entry and banner, a real remote).

- **Emulator**: AVD `Television_1080p` (Android TV 14, arm64; created with `avdmanager create avd -n Television_1080p -k "system-images;android-34;android-tv;arm64-v8a" -d tv_1080p`). Boot it on its own port so it never takes another emulator's serial: `emulator -avd Television_1080p -port 5580 …`, then `export ANDROID_SERIAL=emulator-5580`.
- **Open the app**: `adb shell am start -n io.github.someoneinthe.dishescook/.MainActivity` (`monkey -p …` doesn't start it on TV).
- **D-pad**: `adb shell input keyevent <code>`, the code being `19` (up), `20` (down), `21` (left), `22` (right), `23` (OK) or `4` (Back); several codes in one command press them in turn (`adb shell input keyevent 20 20 23`). The focused element is the node with `focused="true"` in the `uiautomator` dump. Every focused control must show the focus ring (screenshot), and Back must bring the focus back to what opened the screen.
- **Recipes on the TV**: it can't add any (read-only): sync it with a server, or, on a debug build, write them in the database:
  1. Stop the app, then copy the database **with its WAL**, which can hold committed changes, into a `backup/` folder (`mkdir -p backup` first: the shell opens `backup/<file>` before adb runs): for each of `dishes-cook.db`, `dishes-cook.db-wal` and `dishes-cook.db-shm`, `adb exec-out run-as io.github.someoneinthe.dishescook cat files/SQLite/<file> > backup/<file>`. A missing `-wal` or `-shm` only means there is none: drop its empty backup file. Stop there if `dishes-cook.db` or an existing `-wal`/`-shm` can't be copied, or `backup/dishes-cook.db` is empty: step 4 would push that broken backup over the device's data. Work on another copy, in a new folder so no `-wal`/`-shm` from a previous try mixes in (`mkdir work && cp backup/* work/`, like step 4), and never touch `backup/`: step 4 restores it.
  2. Checkpoint the working copy so the WAL's changes are in the `.db` file: `sqlite3 work/dishes-cook.db "PRAGMA wal_checkpoint(TRUNCATE)"`, then insert rows with `sqlite3`, then checkpoint again: the inserts may still be in the copy's WAL, which step 3 doesn't push.
  3. Push `dishes-cook.db` back through `/data/local/tmp` (`run-as … sh -c 'cat /data/local/tmp/… > files/SQLite/dishes-cook.db'`) and delete the device's `-wal`/`-shm` if there are any (`rm -f`): their changes are already in the pushed file, and a leftover WAL would be replayed over it.
  4. Once the check is done, stop the app, copy `backup/` to a fresh folder (`mkdir restore && cp backup/* restore/`: `mkdir` fails if a previous try left `restore/`, then pick a new name rather than reuse it), checkpoint `restore/dishes-cook.db` (as in step 2, without inserting anything) and push it back as in step 3: the test rows go (see step 6, test data). `backup/` itself stays untouched, in case the restore has to be done again.
- **Real TV** (32-bit ARM, Android 11; adb debugging over the network): `adb connect <tv-ip>:5555`, then build a standalone APK for its ABI only and install it:

  ```bash
  (cd android && ./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a)
  adb -s <tv-ip>:5555 install -r android/app/build/outputs/apk/release/app-release.apk
  ```

  The local release build is signed with the debug key: uninstall it before installing a GitHub release APK (different signature).

- **Two Metro servers** (another worktree serving 8081): start this one with `--port 8082`. Emulators reach the Mac's 8081 directly (`10.0.2.2`), so `adb reverse` isn't enough: point the debug app at the other port once, before opening it:

  ```bash
  adb shell "run-as io.github.someoneinthe.dishescook sh -c 'mkdir -p shared_prefs && echo \"<map><string name=\\\"debug_http_host\\\">localhost:8082</string></map>\" > shared_prefs/io.github.someoneinthe.dishescook_preferences.xml'"
  adb reverse tcp:8082 tcp:8082
  ```

## 8. The maintainer's real phone (when asked)

Their phone holds their real recipes. Check with them first, and keep it that way:

- **Never change its settings** (stay awake, keyboard, navigation mode, developer options, font size): ask them to unlock it or to change a setting themselves. Drive the app only, and never save, delete or sync anything unless asked; leave a form with Back without saving.
- **Not a branch with an unmerged migration** (it would run on their data, and the migration may still change in review): build a worktree on `origin/main` with only the change to test, as a local release build, and install it over theirs. Their app is a local release build too (same debug-key signature), so `install -r` keeps their data:

  ```bash
  git worktree add --detach ../dishes-cook-test origin/main   # then apply the change there
  cd ../dishes-cook-test && npm ci && npx expo prebuild --platform android --clean
  (cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a)   # JDK 17 and ANDROID_HOME as in step 2
  adb -s <phone-serial> install -r android/app/build/outputs/apk/release/app-release.apk
  ```

  JS logs of a release build still reach `logcat` (`console.warn`). Remove the worktree afterwards, and once the PR merges, install `main` the same way.

- **What only a real phone shows**: its own keyboard (SwiftKey on the maintainer's Pixel 9a didn't shrink the screen, Gboard on the emulator does), 3-button navigation, the camera.

## Troubleshooting

- **Blank/black screen, `splashscreen_icon_view` still in the view hierarchy**: the native splash is never hidden; JS errors are hidden behind it, so check `metro.log` and `logcat`.
- **Edits don't show up**: see step 4 (`CI=1`, file watcher, stale bundle).
- **Metro died with `MODULE_NOT_FOUND`** (e.g. `@expo/metro`): `npm ci` or `npx expo install` ran while it was serving. Restart it as in step 4; if the new one asks for port 8082, the old one hadn't exited yet: wait a second and start it again.
- **`adb: device offline`, or the emulator rebooted**: wait for `sys.boot_completed` again (step 1), then reopen the app (step 4).
- **"isn't responding" dialogs again and again**, and `logcat` shows a system service restarting in a loop (e.g. `libnfc_nci: Timeout waiting for NFC AIDL service`): the emulator itself is unhealthy, often after a Gradle build starved it. `adb reboot`, wait for `sys.boot_completed`, `adb reverse` again and reopen the app. Don't drive an emulator while Gradle builds.
- **Theme check**: `$ADB shell cmd uimode night yes|no` toggles dark mode live.
