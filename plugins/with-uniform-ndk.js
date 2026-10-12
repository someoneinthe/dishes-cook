// Expo config plugin: make every Android library module use the app's NDK version.
//
// Modules that don't declare an `ndkVersion` (e.g. react-native-unistyles) fall back to the
// Android Gradle plugin's default NDK, so a second NDK (~2 GB) gets downloaded next to the one
// React Native uses. This applies `rootProject.ext.ndkVersion` (set by expo-root-project) as the
// default; a module that sets its own ndkVersion still overrides it.
const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// @generated with-uniform-ndk';

const SNIPPET = `
${MARKER}
subprojects { subproject ->
  subproject.plugins.withId('com.android.library') {
    subproject.android.ndkVersion = rootProject.ext.ndkVersion
  }
}
`;

module.exports = function withUniformNdk(config) {
  return withProjectBuildGradle(config, (moduleConfig) => {
    if (!moduleConfig.modResults.contents.includes(MARKER)) {
      moduleConfig.modResults.contents += SNIPPET;
    }
    return moduleConfig;
  });
};
