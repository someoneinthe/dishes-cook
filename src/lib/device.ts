import { Platform } from 'react-native';

// Running on a TV (Android TV): driven by a remote's D-pad, and read-only there: recipes and
// ingredients are written on the phone. Read once: a device doesn't become a TV while running.
export const isTv = Platform.isTV;
// Running in a browser (the web app, served by the sync server): no native modules there, so the
// features that need one have a web version or are left out.
export const isWeb = Platform.OS === 'web';
