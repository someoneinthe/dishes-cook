import { Stack } from 'expo-router';
import { preventAutoHideAsync } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { AlertHost } from '@/components/alert-host';
import { headerTitleWithIcon } from '@/components/header-title';
import { MENU_ICONS } from '@/components/menu-entry-options';
import { stackHeader } from '@/components/stack-header';
import { DatabaseProvider } from '@/db/database-provider';
import { LoadingScreen } from '@/features/loading/loading-screen';
import { deleteUnusedPhotos } from '@/features/recipes/recipe-photos';
import { deleteSharedPdfs } from '@/features/recipes/share-recipe-pdf';
import { applyColorScheme, getPreferences, usePreferences } from '@/features/settings/preferences';
import { useAutoSync } from '@/features/sync/use-auto-sync';
import { I18nProvider, useMessages } from '@/i18n/i18n-provider';

// Keep the native splash screen until the loading screen (the icon) is rendered. Called at module
// scope without awaiting, as Expo recommends (Metro doesn't support top-level await).
void preventAutoHideAsync();

// PDFs left from a recipe shared when the app was closed (src/features/recipes/share-recipe-pdf.ts).
deleteSharedPdfs();

// The saved light/dark choice, before the first screen renders.
applyColorScheme(getPreferences().colorScheme);

export default function RootLayout() {
  const [isLoadingScreenVisible, setIsLoadingScreenVisible] = useState(true);
  const { language } = usePreferences();

  return (
    // The drawer's swipe gesture needs the gesture handler root.
    <GestureHandlerRootView style={styles.root}>
      <I18nProvider language={language}>
        {/* Photos no recipe uses any more (replaced by a sync, or a form left unsaved): deleted. */}
        <DatabaseProvider onReady={({ db }) => deleteUnusedPhotos(db)}>
          {/* Every screen ends above the keyboard: Android draws the app under it (edge to edge)
              and doesn't always shrink the screen itself (e.g. with SwiftKey), hiding the field
              being typed in. Where Android already does, this adds nothing. */}
          {/* Every screen ends above Android's navigation buttons (3-button bar or gesture area):
              the app is drawn under them (edge to edge), so the end of a list or a page stayed
              behind them. Outside the keyboard's view: the keyboard covers this space too. */}
          <View style={styles.screens}>
            <KeyboardAvoidingView behavior="padding" style={styles.root}>
              <RootStack />
            </KeyboardAvoidingView>
          </View>
        </DatabaseProvider>
        <StatusBar style="auto" />
        {/* The web's dialogs (Android shows its own). */}
        <AlertHost />
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
  // Inside the database provider: syncs with the server set in Settings, if any.
  useAutoSync();

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

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
  },
  // Under the navigation buttons: the screens' background.
  screens: {
    backgroundColor: theme.colors.background,
    flex: 1,
    paddingBottom: rt.insets.bottom,
  },
}));
