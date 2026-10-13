import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

// The app's icon set: https://pictogrammers.com/library/mdi/ (names without the "mdi-" prefix).
export { default as Icon } from '@expo/vector-icons/MaterialCommunityIcons';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
