import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type EmptyStateProps = Readonly<{
  children?: ReactNode;
  message: string;
  title: string;
}>;

export function EmptyState({ children, message, title }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: 'center',
    gap: theme.gap(2),
    padding: theme.gap(6),
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  title: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
    textAlign: 'center',
  },
}));
