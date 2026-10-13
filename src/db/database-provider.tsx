import type { ReactNode } from 'react';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { DatabaseConnection } from './types';
import { backfillSortKeys } from './backfill-sort-keys';
import { openAppConnection } from './client';
import { createQueryClient, DataProvider } from './data-provider';
import migrations from './migrations/migrations';

type DatabaseProviderProps = Readonly<{ children: ReactNode }>;

type MigratedDataProps = Readonly<{ children: ReactNode; connection: DatabaseConnection }>;

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
  return isMigrated ? <MigratedData connection={connection}>{children}</MigratedData> : null;
}

function MigratedData({ children, connection }: MigratedDataProps) {
  // Once, before the first screen renders (screens sort by sort_key), then the query cache.
  const [queryClient] = useState(() => {
    backfillSortKeys(connection.db);
    return createQueryClient();
  });

  return (
    <DataProvider connection={connection} queryClient={queryClient}>
      {children}
    </DataProvider>
  );
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
