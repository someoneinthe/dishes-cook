import { StyleSheet } from 'react-native-unistyles';
import { darkTheme, lightTheme } from './themes';

const themes = {
  dark: darkTheme,
  light: lightTheme,
};

const breakpoints = {
  xs: 0,
  // eslint-disable-next-line perfectionist/sort-objects -- breakpoints must stay in ascending order.
  md: 600,
};

type AppBreakpoints = typeof breakpoints;
type AppThemes = typeof themes;

declare module 'react-native-unistyles' {
  // Module augmentation merges into the library's (empty) interfaces.
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  export interface UnistylesBreakpoints extends AppBreakpoints {}
  export interface UnistylesThemes extends AppThemes {}
  /* eslint-enable @typescript-eslint/no-empty-object-type */
}

// Must run before any StyleSheet.create: imported from the app entry (index.ts) and Jest setup.
StyleSheet.configure({
  breakpoints,
  // Follows the system light/dark setting.
  settings: { adaptiveThemes: true },
  themes,
});
