import { Stack } from 'expo-router';
import { preventAutoHideAsync } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { headerTitleWithIcon } from '@/components/header-title';
import { MENU_ICONS } from '@/components/menu-entry-options';
import { StackHeader } from '@/components/stack-header';
import { DatabaseProvider } from '@/db/database-provider';
import { LoadingScreen } from '@/features/loading/loading-screen';
import { applyColorScheme, getPreferences } from '@/features/settings/preferences';

// Keep the native splash screen until the loading illustration is rendered. Called at module
// scope without awaiting, as Expo recommends (Metro doesn't support top-level await).
void preventAutoHideAsync();

// The saved light/dark choice, before the first screen renders.
applyColorScheme(getPreferences().colorScheme);

export default function RootLayout() {
  const [isLoadingScreenVisible, setIsLoadingScreenVisible] = useState(true);
  // Navigation options aren't styles, so the theme is read here; it updates on light/dark changes.
  const { theme } = useUnistyles();

  return (
    // The drawer's swipe gesture needs the gesture handler root.
    <GestureHandlerRootView style={styles.root}>
      <DatabaseProvider>
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: theme.colors.background },
            header: StackHeader,
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTintColor: theme.colors.text,
            // The screens over the menu are all recipe screens (detail, new, edit).
            headerTitle: headerTitleWithIcon(MENU_ICONS.recipes, theme.colors.menuRecipes),
          }}
        >
          {/* The drawer (burger menu) has its own header. */}
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        </Stack>
      </DatabaseProvider>
      <StatusBar style="auto" />
      {isLoadingScreenVisible && (
        <LoadingScreen onFinish={() => setIsLoadingScreenVisible(false)} />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
