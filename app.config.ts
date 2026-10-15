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
      // App icon (assets/source/app-icon.jpg): plate and cutlery on the icon's blue-grey;
      // monochrome = simplified glyph for Android 13+ themed icons.
      adaptiveIcon: {
        backgroundColor: '#C0CBCF',
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
      icon: './assets/images/icon.png',
    },
    name: 'Dishes Cook',
    orientation: 'portrait',
    plugins: [
      'expo-router',
      [
        'expo-localization',
        {
          // Applies a change of the phone's language without restarting the app.
          allowDynamicLocaleChangesAndroid: true,
          // The app's languages, also listed in Android 13+'s per-app language settings.
          supportedLocales: ['en', 'fr'],
        },
      ],
      // One NDK for every native module (see the plugin).
      './plugins/with-uniform-ndk.js',
      // The sync server's sign-in token, encrypted. The plugin keeps it out of Android Auto Backup
      // (a restored copy couldn't be decrypted anyway: the Keystore key stays on the device).
      'expo-secure-store',
      // Android TV: TV launcher entry with its banner (from assets/source/app-icon.jpg), landscape.
      ['./plugins/with-android-tv.js', { banner: './assets/images/tv-banner.png' }],
      [
        'expo-splash-screen',
        // Android 12+ only allows a centered icon: the app icon's plate and cutlery.
        {
          backgroundColor: '#FFFFFF',
          // Dark mode: Material dark surface instead of a white flash before the loading screen.
          dark: {
            backgroundColor: '#121212',
            image: './assets/images/splash-icon.png',
          },
          image: './assets/images/splash-icon.png',
          imageWidth: 240,
        },
      ],
      // End-to-end test builds only (CI's Maestro job): plain HTTP to the test sync server.
      ...(process.env.E2E_BUILD === '1' ? ['./plugins/with-e2e-cleartext.js'] : []),
    ],
    scheme: 'dishescook',
    slug: 'dishes-cook',
    userInterfaceStyle: 'automatic',
    version,
  };
}
