import { Platform } from 'react-native';

// Running on a TV (Android TV): driven by a remote's D-pad, and read-only there: recipes and
// ingredients are written on the phone. Read once: a device doesn't become a TV while running.
export const isTv = Platform.isTV;
