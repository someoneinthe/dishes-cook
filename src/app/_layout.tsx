import { Stack } from 'expo-router';
import { preventAutoHideAsync } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { headerTitleWithIcon } from '@/components/header-title';
import { MENU_ICONS } from '@/components/menu-entry-options';
import { stackHeader } from '@/components/stack-header';
import { DatabaseProvider } from '@/db/database-provider';
import { LoadingScreen } from '@/features/loading/loading-screen';
import { applyColorScheme, getPreferences, usePreferences } from '@/features/settings/preferences';
import { I18nProvider, useMessages } from '@/i18n/i18n-provider';

// Keep the native splash screen until the loading illustration is rendered. Called at module
// scope without awaiting, as Expo recommends (Metro doesn't support top-level await).
void preventAutoHideAsync();

// The saved light/dark choice, before the first screen renders.
applyColorScheme(getPreferences().colorScheme);

export default function RootLayout() {
  const [isLoadingScreenVisible, setIsLoadingScreenVisible] = useState(true);
  const { language } = usePreferences();

  return (
    // The drawer's swipe gesture needs the gesture handler root.
    <GestureHandlerRootView style={styles.root}>
      <I18nProvider language={language}>
        <DatabaseProvider>
          <RootStack />
        </DatabaseProvider>
        <StatusBar style="auto" />
        {isLoadingScreenVisible && (
          <LoadingScreen onFinish={() => setIsLoadingScreenVisible(false)} />
        )}
      </I18nProvider>
    </GestureHandlerRootView>
  );
}

// Inside the i18n provider: the back button is read in the app's language.
function RootStack() {
  // Navigation options aren't styles, so the theme is read here; it updates on light/dark changes.
  const { theme } = useUnistyles();
  const t = useMessages();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.colors.background },
        header: stackHeader(t.common.back),
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        // The screens over the menu are all recipe screens (detail, new, edit).
        headerTitle: headerTitleWithIcon(MENU_ICONS.recipes, theme.colors.menuRecipes),
      }}
    >
      {/* The drawer (burger menu) has its own header. */}
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
