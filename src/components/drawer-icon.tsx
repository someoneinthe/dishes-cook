import type { ColorValue } from 'react-native';
import type { IconName } from './icon';
import { Icon } from './icon';

// `drawerIcon` option of a menu entry: the icon takes the entry's color (active or not) and size.
export function drawerIcon(name: IconName) {
  return function DrawerIcon({ color, size }: Readonly<{ color: ColorValue; size: number }>) {
    return <Icon color={color} name={name} size={size} />;
  };
}
