import type { ReactNode } from 'react';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { openAppConnection } from './client';
import { DatabaseContext } from './database-context';
import migrations from './migrations/migrations';

type DatabaseProviderProps = Readonly<{ children: ReactNode }>;

// Opens the database, applies pending migrations, then renders the app. Nothing is rendered while
// migrating: it takes milliseconds and the loading screen covers the app meanwhile.
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [connection] = useState(openAppConnection);
  const { error, success: isMigrated } = useMigrations(connection.db, migrations);

  if (error) {
    return (
      <View style={styles.error}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          {`The recipes database could not be opened: ${error.message}`}
        </Text>
      </View>
    );
  }
  return isMigrated ? <DatabaseContext value={connection}>{children}</DatabaseContext> : null;
}

const styles = StyleSheet.create((theme) => ({
  error: {
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: theme.gap(4),
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
}));
