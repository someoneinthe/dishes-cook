import createIconSet from '@expo/vector-icons/createIconSet';
import { iconFont } from '@/lib/assets';
import glyphMap from './icon-glyphs.json';

// The app's icons: Material Design Icons (https://pictogrammers.com/library/mdi/, names without the
// "mdi-" prefix), in a font holding only the ones the app uses (assets/fonts/app-icons.ttf). Another
// icon goes in with `npm run icons -- add <name>`.
export const Icon = createIconSet(glyphMap, 'app-icons', iconFont);

export type IconName = keyof typeof glyphMap;
