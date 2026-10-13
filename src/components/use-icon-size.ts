import { useWindowDimensions } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

// Icon sizes grow with the phone's font size setting, like the text next to them.
export function useIconSize(size: 'md' | 'sm'): number {
  const { fontScale } = useWindowDimensions();
  const { theme } = useUnistyles();
  return Math.round(theme.iconSize[size] * fontScale);
}
