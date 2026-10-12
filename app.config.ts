import type { ConfigContext, ExpoConfig } from 'expo/config';

import { version } from './package.json';

// package.json is the single source of truth for the version (bumped by release-please).
// Android needs a monotonically increasing integer: 1.2.3 -> 1002003.
const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
const versionCode = major * 1_000_000 + minor * 1_000 + patch;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Dishes Cook',
  slug: 'dishes-cook',
  version,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'dishescook',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'io.github.someoneinthe.dishescook',
    buildNumber: String(versionCode),
  },
  android: {
    package: 'io.github.someoneinthe.dishescook',
    versionCode,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
