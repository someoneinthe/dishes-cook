import { Drawer } from 'expo-router/drawer';
import { useUnistyles } from 'react-native-unistyles';

// Opening the app lands on the meal choice, whatever the menu order.
// eslint-disable-next-line @typescript-eslint/naming-convention -- name required by Expo Router.
export const unstable_settings = { initialRouteName: 'index' };

// The burger menu. Drinks will be added here as a fourth entry.
export default function DrawerLayout() {
  // Navigation options aren't styles, so the theme is read here; it updates on light/dark changes.
  const { theme } = useUnistyles();

  return (
    <Drawer
      backBehavior="initialRoute"
      screenOptions={{
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: theme.colors.text,
        drawerStyle: { backgroundColor: theme.colors.background },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Drawer.Screen
        name="ingredients"
        options={{ drawerLabel: 'Ingredients', title: 'Ingredients' }}
      />
      <Drawer.Screen name="recipes" options={{ drawerLabel: 'Recipes', title: 'Recipes' }} />
      <Drawer.Screen
        name="index"
        options={{ drawerLabel: 'Meal choice', title: 'What should we eat?' }}
      />
    </Drawer>
  );
}
