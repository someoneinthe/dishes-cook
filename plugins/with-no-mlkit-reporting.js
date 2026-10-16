// Expo config plugin: ML Kit's text recognition (a recipe from a photo) reads the text on the phone,
// but reports its usage to Google (https://developers.google.com/ml-kit/android-data-disclosure):
// it logs events through Google's datatransport library, whose CCT backend uploads them to
// firebaselogging.googleapis.com. The app makes no network call but the sync (CLAUDE.md), so the
// manifest merger drops that backend: without one, datatransport deletes the events instead of
// uploading them ("Unknown backend for cct"). Checked on the emulator, see docs/tech-stack.md.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const DISCOVERY_SERVICE =
  'com.google.android.datatransport.runtime.backends.TransportBackendDiscovery';
const CCT_BACKEND = 'backend:com.google.android.datatransport.cct.CctBackendFactory';

module.exports = function withNoMlKitReporting(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults;
    manifest.manifest.$['xmlns:tools'] ??= 'http://schemas.android.com/tools';
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app.service ??= [];
    if (app.service.every((service) => service.$['android:name'] !== DISCOVERY_SERVICE)) {
      app.service.push({
        $: { 'android:exported': 'false', 'android:name': DISCOVERY_SERVICE },
        'meta-data': [{ $: { 'android:name': CCT_BACKEND, 'tools:node': 'remove' } }],
      });
    }
    return manifestConfig;
  });
};
