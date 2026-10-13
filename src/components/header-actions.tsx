import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type HeaderActionsProps = Readonly<{ children: ReactNode }>;

// The buttons of a screen, at the top right of its header (`headerRight` option).
export function HeaderActions({ children }: HeaderActionsProps) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    gap: theme.gap(2),
    paddingRight: theme.gap(3),
  },
}));
