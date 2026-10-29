import { Image as ExpoImage } from 'expo-image';
import { DrawerContentScrollView as DrawerScrollView } from 'expo-router/drawer';
import { GestureHandlerRootView as GestureRootView } from 'react-native-gesture-handler';
import { withUnistyles } from 'react-native-unistyles';

// Components of other libraries given the app's styles (Unistyles StyleSheets). In a browser,
// Unistyles only styles React Native's own components: these got no style at all (no size: an
// empty page, a loading screen that never ended). withUnistyles passes them the styles, on a phone
// too. ESLint asks to import them from here.

export const DrawerContentScrollView = withUnistyles(DrawerScrollView);
export const GestureHandlerRootView = withUnistyles(GestureRootView);
export const Image = withUnistyles(ExpoImage);
