// Expo config plugin, only for end-to-end test builds (`E2E_BUILD=1`, see .maestro/README.md): lets
// a release build reach the throwaway sync server over plain HTTP on the emulator's localhost.
// Debug builds already allow it (for Metro); the released app never does.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withEndToEndCleartext(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifestConfig.modResults);
    app.$['android:usesCleartextTraffic'] = 'true';
    return manifestConfig;
  });
};
