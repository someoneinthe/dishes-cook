import type { ComponentProps } from 'react';
import { DrawerToggleButton } from 'expo-router/drawer';

type DrawerToggleProps = ComponentProps<typeof DrawerToggleButton>;

// `headerLeft` option of the menu's screens: the menu button, read in the app's language (React
// Navigation's own label is English). Built outside the layout, so it doesn't define a component
// while rendering (Sonar S6478).
export function drawerToggle(accessibilityLabel: string) {
  return function DrawerToggle(props: DrawerToggleProps) {
    // React Navigation's header buttons take no accessibilityHint.
    // eslint-disable-next-line react-native-a11y/has-accessibility-hint
    return <DrawerToggleButton {...props} accessibilityLabel={accessibilityLabel} />;
  };
}
