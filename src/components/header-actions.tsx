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

// `headerRight` option showing `children` at the top right of the header. Built here, outside the
// screens, so screens don't define a component while rendering (Sonar S6478).
export function headerActions(children: ReactNode) {
  return function HeaderRight() {
    return <HeaderActions>{children}</HeaderActions>;
  };
}
