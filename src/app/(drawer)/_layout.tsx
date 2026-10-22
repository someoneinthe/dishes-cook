import { Drawer } from 'expo-router/drawer';
import { useUnistyles } from 'react-native-unistyles';
import { drawerToggle } from '@/components/drawer-toggle';
import { headerTitleOptions } from '@/components/header-title';
import { MENU_ICONS, menuEntryOptions } from '@/components/menu-entry-options';
import { phoneMenu } from '@/components/phone-menu';
import { noMenuButton, tvMenu, useTvMenuWidth } from '@/components/tv-menu';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';

// Opening the app lands on the meal choice.
// eslint-disable-next-line @typescript-eslint/naming-convention, sonarjs/variable-name -- name required by Expo Router.
export const unstable_settings = { anchor: 'index' };

// The burger menu.
export default function DrawerLayout() {
  // Navigation options aren't styles, so the theme is read here; it updates on light/dark changes.
  const { theme } = useUnistyles();
  const t = useMessages();
  const tvMenuWidth = useTvMenuWidth();

  return (
    <Drawer
      backBehavior="initialRoute"
      // Settings and About at the bottom of the menu (src/components/menu-sections.ts).
      drawerContent={isTv ? tvMenu : phoneMenu}
      screenOptions={{
        ...headerTitleOptions,
        // The current screen: a light blue tint, like other options that are on (text ≥ 4.5:1).
        drawerActiveBackgroundColor: theme.colors.actionSoft,
        drawerActiveTintColor: theme.colors.onActionSoft,
        drawerInactiveTintColor: theme.colors.text,
        drawerStyle: {
          backgroundColor: theme.colors.background,
          ...(isTv && { width: tvMenuWidth }),
        },
        // On a TV, the menu stays on the left of the screen: the remote moves between it and the
        // screen (a menu that slides in would leave its entries in the remote's way when closed).
        drawerType: isTv ? 'permanent' : 'front',
        headerLeft: isTv ? noMenuButton : drawerToggle(t.menu.open),
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        overlayAccessibilityLabel: t.menu.close,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {/* First: Back returns to the first screen listed (`backBehavior`), whatever
          `unstable_settings` says, which only sets the screen the app opens on. */}
      <Drawer.Screen
        name="index"
        options={menuEntryOptions(
          t.menu.mealChoice,
          MENU_ICONS.mealChoice,
          theme.colors.menuMealChoice,
        )}
      />
      <Drawer.Screen
        name="recipes"
        options={menuEntryOptions(t.menu.recipes, MENU_ICONS.recipes, theme.colors.menuRecipes)}
      />
      <Drawer.Screen
        name="ingredients"
        options={{
          ...menuEntryOptions(
            t.menu.ingredients,
            MENU_ICONS.ingredients,
            theme.colors.menuIngredients,
          ),
          // Read-only on a TV: the ingredient list is only there to manage ingredients.
          drawerItemStyle: isTv ? { display: 'none' } : undefined,
        }}
      />
      <Drawer.Screen
        name="drinks"
        options={menuEntryOptions(t.menu.drinks, MENU_ICONS.drinks, theme.colors.menuDrinks)}
      />
      <Drawer.Screen
        name="shopping-list"
        options={{
          ...menuEntryOptions(
            t.menu.shoppingList,
            MENU_ICONS.shoppingList,
            theme.colors.menuShoppingList,
          ),
          // Not on a TV: it's read-only and can't share the list.
          drawerItemStyle: isTv ? { display: 'none' } : undefined,
        }}
      />
      <Drawer.Screen
        name="settings"
        options={menuEntryOptions(t.menu.settings, MENU_ICONS.settings, theme.colors.menuSettings)}
      />
      <Drawer.Screen
        name="about"
        options={menuEntryOptions(t.menu.about, MENU_ICONS.about, theme.colors.menuAbout)}
      />
    </Drawer>
  );
}
