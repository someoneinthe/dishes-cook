import type { ColorValue } from 'react-native';
import type { IconName } from './icon';
import { Icon } from './icon';

// `drawerIcon` option of a menu entry: the icon keeps its own color, active or not (the active
// entry is shown by its label and background), and takes the entry's size.
export function drawerIcon(name: IconName, color: ColorValue) {
  return function DrawerIcon({ size }: Readonly<{ size: number }>) {
    return <Icon color={color} name={name} size={size} />;
  };
}
