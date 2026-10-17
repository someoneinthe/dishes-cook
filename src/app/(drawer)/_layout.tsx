import { Drawer } from 'expo-router/drawer';
import { useUnistyles } from 'react-native-unistyles';
import { drawerToggle } from '@/components/drawer-toggle';
import { headerTitleOptions } from '@/components/header-title';
import { MENU_ICONS, menuEntryOptions } from '@/components/menu-entry-options';
import { noMenuButton, tvMenu, useTvMenuWidth } from '@/components/tv-menu';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';

// Opening the app lands on the meal choice, whatever the menu order.
// eslint-disable-next-line @typescript-eslint/naming-convention -- name required by Expo Router.
export const unstable_settings = { initialRouteName: 'index' };

// The burger menu. Drinks will be added here as an entry (icon: 'glass-cocktail').
export default function DrawerLayout() {
  // Navigation options aren't styles, so the theme is read here; it updates on light/dark changes.
  const { theme } = useUnistyles();
  const t = useMessages();
  const tvMenuWidth = useTvMenuWidth();

  return (
    <Drawer
      backBehavior="initialRoute"
      drawerContent={isTv ? tvMenu : undefined}
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
        name="index"
        options={menuEntryOptions(
          t.menu.mealChoice,
          MENU_ICONS.mealChoice,
          theme.colors.menuMealChoice,
        )}
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
