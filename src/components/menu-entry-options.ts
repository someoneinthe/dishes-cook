import type { IconName } from './icon';
import { drawerIcon } from './drawer-icon';
import { headerTitleWithIcon } from './header-title';

// The icon of each menu entry, also shown before the title of its screens.
export const MENU_ICONS = {
  about: 'information-outline',
  drinks: 'glass-cocktail',
  ingredients: 'carrot',
  mealChoice: 'dice-multiple',
  recipes: 'book-open-page-variant',
  settings: 'cog-outline',
  shoppingList: 'cart-outline',
} as const satisfies Record<string, IconName>;

// Options of a menu (drawer) entry: its icon, in its own color, in the menu and before the title
// of its screen.
export function menuEntryOptions(title: string, icon: IconName, color: string) {
  return {
    drawerIcon: drawerIcon(icon, color),
    drawerLabel: title,
    headerTitle: headerTitleWithIcon(icon, color),
    title,
  };
}
