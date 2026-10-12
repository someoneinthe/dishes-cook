import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { LoadingScreen } from '@/features/loading/loading-screen';

// Keep the native splash screen until the loading illustration is rendered. Called at module
// scope without awaiting, as Expo recommends (Metro doesn't support top-level await).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isLoadingScreenVisible, setIsLoadingScreenVisible] = useState(true);

  return (
    <>
      <Stack />
      <StatusBar style="auto" />
      {isLoadingScreenVisible && (
        <LoadingScreen onFinish={() => setIsLoadingScreenVisible(false)} />
      )}
    </>
  );
}
