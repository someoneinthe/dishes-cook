import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useUnistyles } from 'react-native-unistyles';
import { LoadingScreen } from '@/features/loading/loading-screen';

// Keep the native splash screen until the loading illustration is rendered. Called at module
// scope without awaiting, as Expo recommends (Metro doesn't support top-level await).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isLoadingScreenVisible, setIsLoadingScreenVisible] = useState(true);
  // Navigation options aren't styles, so the theme is read here; it updates on light/dark changes.
  const { theme } = useUnistyles();

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
        }}
      />
      <StatusBar style="auto" />
      {isLoadingScreenVisible && (
        <LoadingScreen onFinish={() => setIsLoadingScreenVisible(false)} />
      )}
    </>
  );
}
