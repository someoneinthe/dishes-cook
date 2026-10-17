import type { ErrorBoundaryProps } from 'expo-router';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { useMessages } from '@/i18n/i18n-provider';

// What a recipe screen (detail, new, edit) shows instead of closing the app when drawing it fails,
// e.g. a recipe synced from another phone with text no screen can show: Back still works, and so
// do the other screens. Exported as the routes' ErrorBoundary (src/app/recipe).
export function RecipeErrorBoundary({ retry }: Readonly<ErrorBoundaryProps>) {
  const t = useMessages();

  return (
    <View style={styles.screen}>
      <EmptyState message={t.recipes.cantShowMessage} title={t.recipes.cantShowTitle}>
        <Button
          icon="refresh"
          label={t.common.tryAgain}
          onPress={() => void retry()}
          variant="secondary"
        />
      </EmptyState>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
}));
