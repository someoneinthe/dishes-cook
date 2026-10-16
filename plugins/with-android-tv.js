const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withMainActivity,
} = require('expo/config-plugins');
// Expo config plugin: make the Android app an Android TV app too.
//
// - Listed in TV launchers: LEANBACK_LAUNCHER category on the main activity, and the banner they
//   show instead of the icon (320×180, drawable-xhdpi).
// - Installable on TVs: touchscreen and leanback declared optional, so the same APK serves phones
//   and TVs.
// - Landscape on TVs: the app stays portrait on phones (`orientation` in app.config.ts), which
//   pillarboxes it on a TV screen. The manifest can't tell the two apart, so the activity lifts
//   the lock when it starts in TV mode (the same test as React Native's `Platform.isTV`).
const fs = require('node:fs');
const path = require('node:path');

const BANNER_RESOURCE = 'tv_banner';
const LEANBACK_LAUNCHER = 'android.intent.category.LEANBACK_LAUNCHER';
const MARKER = '// @generated with-android-tv';

// `screen.portrait` is implied by the portrait orientation of phones (app.config.ts), the camera
// by the CAMERA permission (expo-image-picker: a recipe from a photo): optional too.
const OPTIONAL_FEATURE_LIST = [
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  'android.hardware.screen.portrait',
  'android.hardware.touchscreen',
  'android.software.leanback',
];

// Expo's MainActivity template; the orientation is changed right after it.
const SUPER_ON_CREATE = 'super.onCreate(null)';

const IMPORT_LIST = ['android.content.pm.ActivityInfo', 'android.content.res.Configuration'];

const ORIENTATION_SNIPPET = `
    ${MARKER}
    val uiModeType = resources.configuration.uiMode and Configuration.UI_MODE_TYPE_MASK
    if (uiModeType == Configuration.UI_MODE_TYPE_TELEVISION) {
      requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    }`;

module.exports = function withAndroidTv(config, { banner }) {
  config = withAndroidManifest(config, (manifestConfig) => {
    addTvEntries(manifestConfig.modResults);
    return manifestConfig;
  });
  config = withMainActivity(config, (activityConfig) => {
    activityConfig.modResults.contents = addTvOrientation(activityConfig.modResults.contents);
    return activityConfig;
  });
  return withDangerousMod(config, [
    'android',
    (fileConfig) => {
      const directory = path.join(
        fileConfig.modRequest.platformProjectRoot,
        'app/src/main/res/drawable-xhdpi',
      );
      fs.mkdirSync(directory, { recursive: true });
      fs.copyFileSync(
        path.join(fileConfig.modRequest.projectRoot, banner),
        path.join(directory, `${BANNER_RESOURCE}.png`),
      );
      return fileConfig;
    },
  ]);
};

function addTvEntries(manifest) {
  manifest.manifest['uses-feature'] ??= [];
  const featureList = manifest.manifest['uses-feature'];
  for (const name of OPTIONAL_FEATURE_LIST) {
    if (featureList.every((feature) => feature.$['android:name'] !== name)) {
      featureList.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
  }

  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  app.$['android:banner'] = `@drawable/${BANNER_RESOURCE}`;

  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  const launcherFilter = activity['intent-filter']?.find((filter) =>
    filter.action?.some((action) => action.$['android:name'] === 'android.intent.action.MAIN'),
  );
  if (!launcherFilter) {
    throw new Error('with-android-tv: the main activity has no MAIN intent filter');
  }
  launcherFilter.category ??= [];
  if (
    launcherFilter.category.every((category) => category.$['android:name'] !== LEANBACK_LAUNCHER)
  ) {
    launcherFilter.category.push({ $: { 'android:name': LEANBACK_LAUNCHER } });
  }
}

function addTvOrientation(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }
  if (!contents.includes(SUPER_ON_CREATE)) {
    throw new Error(`with-android-tv: ${SUPER_ON_CREATE} not found in MainActivity`);
  }
  let result = contents.replace(SUPER_ON_CREATE, () => `${SUPER_ON_CREATE}${ORIENTATION_SNIPPET}`);
  for (const name of IMPORT_LIST) {
    if (!result.includes(`import ${name}\n`)) {
      result = result.replace(/^package .+\n/, (line) => `${line}import ${name}\n`);
    }
  }
  return result;
}
