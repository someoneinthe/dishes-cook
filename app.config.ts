import type { ConfigContext, ExpoConfig } from 'expo/config';
import { version } from './package.json';

// package.json is the single source of truth for the version (bumped by release-please).
// Android needs a monotonically increasing integer: 1.2.3 -> 1002003.
const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
const versionCode = major * 1_000_000 + minor * 1000 + patch;

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  return {
    ...config,
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        backgroundImage: './assets/images/android-icon-background.png',
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      package: 'io.github.someoneinthe.dishescook',
      predictiveBackGestureEnabled: false,
      versionCode,
    },
    experiments: {
      reactCompiler: true,
      typedRoutes: true,
    },
    icon: './assets/images/icon.png',
    ios: {
      buildNumber: String(versionCode),
      bundleIdentifier: 'io.github.someoneinthe.dishescook',
      icon: './assets/expo.icon',
    },
    name: 'Dishes Cook',
    orientation: 'portrait',
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        // Android 12+ only allows a centered icon: the plate from the loading illustration.
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 240,
        },
      ],
    ],
    scheme: 'dishescook',
    slug: 'dishes-cook',
    userInterfaceStyle: 'automatic',
    version,
  };
}
