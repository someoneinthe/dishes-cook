import type { DrawerContentComponentProps, DrawerNavigationOptions } from 'expo-router/drawer';
import { DrawerContentScrollView, DrawerItem } from 'expo-router/drawer';
import { CommonActions, DrawerActions } from 'expo-router/react-navigation';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { toMenuSections } from './menu-sections';

type Route = DrawerContentComponentProps['state']['routes'][number];

// `drawerContent` option of the menu on a phone: React Navigation's entries, Settings and About at
// the bottom of the screen (they follow the others when the menu scrolls, with a large font). Built
// here, outside the layout, so it doesn't define a component while rendering (Sonar S6478).
export function phoneMenu(props: DrawerContentComponentProps) {
  return <PhoneMenu {...props} />;
}

// A route's entry, from its options.
function entryOptions(route: Route, options: DrawerNavigationOptions | undefined) {
  return {
    allowFontScaling: options?.drawerAllowFontScaling,
    icon: options?.drawerIcon,
    label: options?.drawerLabel ?? options?.title ?? route.name,
    labelStyle: options?.drawerLabelStyle,
    style: options?.drawerItemStyle,
  };
}

// React Navigation's DrawerItemList, for some of the routes: the entry of the screen shown closes
// the menu, the others open their screen.
function MenuEntryList({
  descriptors,
  navigation,
  routeList,
  state,
}: Readonly<DrawerContentComponentProps & { routeList: readonly Route[] }>) {
  const shownKey = state.routes[state.index]?.key;
  const shownOptions = shownKey === undefined ? undefined : descriptors[shownKey]?.options;
  // The colors are the shown screen's options, as in React Navigation's list.
  const colors = {
    activeBackgroundColor: shownOptions?.drawerActiveBackgroundColor,
    activeTintColor: shownOptions?.drawerActiveTintColor,
    inactiveBackgroundColor: shownOptions?.drawerInactiveBackgroundColor,
    inactiveTintColor: shownOptions?.drawerInactiveTintColor,
  };

  // A fragment: Sonar (S100) only sees a component when it returns a JSX element, not an array.
  return (
    <>
      {routeList.map((route) => {
        const isFocused = route.key === shownKey;
        const onPress = () => {
          const event = navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: 'drawerItemPress',
          });
          if (!event.defaultPrevented) {
            navigation.dispatch({
              ...(isFocused ? DrawerActions.closeDrawer() : CommonActions.navigate(route)),
              target: state.key,
            });
          }
        };
        return (
          <DrawerItem
            {...colors}
            {...entryOptions(route, descriptors[route.key]?.options)}
            focused={isFocused}
            key={route.key}
            onPress={onPress}
          />
        );
      })}
    </>
  );
}

function PhoneMenu(props: Readonly<DrawerContentComponentProps>) {
  const { bottomList, topList } = toMenuSections(props.state.routes);

  return (
    <DrawerContentScrollView contentContainerStyle={styles.list}>
      <View style={styles.top}>
        <MenuEntryList {...props} routeList={topList} />
      </View>
      <MenuEntryList {...props} routeList={bottomList} />
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  // At least the menu's height, so the bottom entries reach its bottom.
  list: {
    flexGrow: 1,
  },
  top: {
    flexGrow: 1,
  },
});
