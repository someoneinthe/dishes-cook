import { useWindowDimensions } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { isTv, isWeb } from '@/lib/device';

// Whether the menu stays open on the left of the screens instead of sliding in from the burger: on
// a TV (the remote moves between it and the screen), and in a browser window wide enough for the
// menu and a screen's content side by side (narrower, a browser shows the phone's burger menu).
export function useIsMenuAlwaysOpen(): boolean {
  const { width } = useWindowDimensions();
  const { theme } = useUnistyles();
  return isTv || (isWeb && width >= theme.size.tvMenu + theme.size.maxContent);
}
