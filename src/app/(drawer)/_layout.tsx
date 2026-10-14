import { Drawer } from 'expo-router/drawer';
import { useUnistyles } from 'react-native-unistyles';
import { drawerToggle } from '@/components/drawer-toggle';
import { headerTitleOptions } from '@/components/header-title';
import { MENU_ICONS, menuEntryOptions } from '@/components/menu-entry-options';
import { useMessages } from '@/i18n/i18n-provider';

// Opening the app lands on the meal choice, whatever the menu order.
// eslint-disable-next-line @typescript-eslint/naming-convention -- name required by Expo Router.
export const unstable_settings = { initialRouteName: 'index' };

// The burger menu. Drinks will be added here as a fourth entry (icon: 'glass-cocktail').
export default function DrawerLayout() {
  // Navigation options aren't styles, so the theme is read here; it updates on light/dark changes.
  const { theme } = useUnistyles();
  const t = useMessages();

  return (
    <Drawer
      backBehavior="initialRoute"
      screenOptions={{
        ...headerTitleOptions,
        drawerActiveTintColor: theme.colors.actionPrimary,
        drawerInactiveTintColor: theme.colors.text,
        drawerStyle: { backgroundColor: theme.colors.background },
        headerLeft: drawerToggle(t.menu.open),
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        overlayAccessibilityLabel: t.menu.close,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Drawer.Screen
        name="ingredients"
        options={menuEntryOptions(
          t.menu.ingredients,
          MENU_ICONS.ingredients,
          theme.colors.menuIngredients,
        )}
      />
      <Drawer.Screen
        name="recipes"
        options={menuEntryOptions(t.menu.recipes, MENU_ICONS.recipes, theme.colors.menuRecipes)}
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
    </Drawer>
  );
}
