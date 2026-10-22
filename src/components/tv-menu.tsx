import type { DrawerContentComponentProps } from 'expo-router/drawer';
import type { ReactNode, Ref } from 'react';
import type { ViewInstance } from 'react-native';
import { DrawerContentScrollView } from 'expo-router/drawer';
import { useCallback, useState } from 'react';
import {
  findNodeHandle,
  StyleSheet as NativeStyleSheet,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';
import { toMenuSections } from './menu-sections';
import { useFocusRing } from './use-focus-ring';
import { useIconSize } from './use-icon-size';

type TvMenuEntryProps = Readonly<{
  icon: ReactNode;
  isActive: boolean;
  // Takes the remote's focus when it turns true (back from the screen this entry opened).
  isTvPreferredFocus: boolean;
  label: string;
  // The entries the remote's Down and Up keys go to (Android view ids), when they aren't the
  // nearest ones on screen.
  nextFocusDown?: number;
  nextFocusUp?: number;
  onPress: () => void;
  ref?: Ref<ViewInstance>;
}>;

// The menu widens with the font size, so its entries' words aren't cut; up to half again, beyond
// which it would take the screens' room.
const MAX_MENU_SCALE = 1.5;

// `headerLeft` option when the menu is always shown (TV): no menu button.
export function noMenuButton() {
  return null;
}

// `drawerContent` option of the menu on a TV. Built here, outside the layout, so it doesn't define
// a component while rendering (Sonar S6478).
export function tvMenu(props: DrawerContentComponentProps) {
  return <TvMenu {...props} />;
}

// `drawerStyle.width` of the menu on a TV.
export function useTvMenuWidth(): number {
  const { fontScale } = useWindowDimensions();
  const { theme } = useUnistyles();
  return Math.round(theme.size.tvMenu * Math.min(fontScale, MAX_MENU_SCALE));
}

// The menu on a TV, always shown on the left: its entries show the remote's focus ring, which
// React Navigation's own entries don't. Entries hidden from the menu (`drawerItemStyle` with
// `display: 'none'`, e.g. the ingredients) and entries without a title are left out.
function TvMenu({ descriptors, navigation, state }: Readonly<DrawerContentComponentProps>) {
  const iconSize = useIconSize('lg');
  // Icon colors are props, not styles.
  const { theme } = useUnistyles();
  const { focusReturnKey, openFromMenu } = useMenuFocusReturn(state);

  const shownKey = state.routes[state.index]?.key;
  const { bottomList, topList } = toMenuSections(
    state.routes.filter((route) => {
      const options = descriptors[route.key]?.options;
      return (
        options?.title && NativeStyleSheet.flatten(options.drawerItemStyle)?.display !== 'none'
      );
    }),
  );
  // Down from the last top entry goes to the first bottom one, and Up back: the remote would go to
  // the screen, nearer than the gap between them.
  const [lastTopId, setLastTopId] = useState<number>();
  const [firstBottomId, setFirstBottomId] = useState<number>();
  const lastTopRef = useCallback((view: null | ViewInstance) => setLastTopId(viewId(view)), []);
  const firstBottomRef = useCallback(
    (view: null | ViewInstance) => setFirstBottomId(viewId(view)),
    [],
  );
  const entryList = (routeList: typeof state.routes, edge: 'first' | 'last') =>
    routeList.map((route, index) => {
      const options = descriptors[route.key]?.options;
      if (!options?.title) {
        return null;
      }
      const isEdge = index === (edge === 'first' ? 0 : routeList.length - 1);
      const isActive = route.key === shownKey;
      const color = isActive ? theme.colors.onActionSoft : theme.colors.text;
      return (
        <TvMenuEntry
          icon={options.drawerIcon?.({ color, focused: isActive, size: iconSize })}
          isActive={isActive}
          isTvPreferredFocus={route.key === focusReturnKey}
          key={route.key}
          label={options.title}
          {...(isEdge &&
            (edge === 'last'
              ? { nextFocusDown: firstBottomId, ref: lastTopRef }
              : { nextFocusUp: lastTopId, ref: firstBottomRef }))}
          onPress={() => {
            openFromMenu(route.key);
            navigation.navigate(route.name);
          }}
        />
      );
    });

  return (
    // Settings and About at the bottom of the screen; they follow the others when the menu scrolls
    // (with a large font).
    <DrawerContentScrollView contentContainerStyle={styles.list}>
      <View style={styles.top}>{entryList(topList, 'last')}</View>
      {entryList(bottomList, 'first')}
    </DrawerContentScrollView>
  );
}

function TvMenuEntry({
  icon,
  isActive,
  isTvPreferredFocus,
  label,
  nextFocusDown,
  nextFocusUp,
  onPress,
  ref,
}: TvMenuEntryProps) {
  styles.useVariants({ isActive });
  const t = useMessages();
  const { focusProps, focusStyle } = useFocusRing();
  // Re-renders on light/dark changes, like the entries' colors.
  useUnistyles();

  return (
    <Pressable
      accessibilityHint={t.menu.openScreenHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      // Android requests the focus when this turns true (the typings only mention Apple TV).
      // eslint-disable-next-line sonarjs/deprecation
      hasTVPreferredFocus={isTvPreferredFocus}
      onPress={onPress}
      ref={ref}
      // Android view props, passed on to the view (missing from Pressable's typings).
      {...{ nextFocusDown, nextFocusUp }}
      {...focusProps}
      style={[styles.entry, focusStyle]}
    >
      {icon}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

// Back from a screen opened by a menu entry (Back always leads to the first screen, the meal
// choice): the remote's focus returns to that entry, as it returns to what opened any other screen.
function useMenuFocusReturn({ index, routes }: DrawerContentComponentProps['state']) {
  const shownKey = routes[index]?.key;
  const [lastShownKey, setLastShownKey] = useState(shownKey);
  // The entry just pressed, then the screen it opened while it's shown.
  const [pressedKey, setPressedKey] = useState<string>();
  const [openedKey, setOpenedKey] = useState<string>();
  const [focusReturnKey, setFocusReturnKey] = useState<string>();
  // Another screen shown: worked out while rendering, so the entry asks for the focus at once.
  if (shownKey !== lastShownKey) {
    const isFromMenu = pressedKey === shownKey;
    setLastShownKey(shownKey);
    setPressedKey(undefined);
    setOpenedKey(isFromMenu ? shownKey : undefined);
    setFocusReturnKey(!isFromMenu && index === 0 ? openedKey : undefined);
  }
  return { focusReturnKey, openFromMenu: setPressedKey };
}

// A view's Android id, for the `nextFocus…` props.
function viewId(view: null | ViewInstance): number | undefined {
  return (view && findNodeHandle(view)) ?? undefined;
}

const styles = StyleSheet.create((theme) => ({
  entry: {
    alignItems: 'center',
    // A bar on the left marks the current screen; the others keep its room, so labels line up.
    borderLeftWidth: theme.borderWidthThick,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.gap(3),
    minHeight: theme.size.touchTarget,
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(2),
    variants: {
      // The current screen: a light tint like other options that are on, which a TV across the
      // room hardly shows, so also a bar (≥ 3:1 on the background) and a bolder label.
      isActive: {
        false: { borderLeftColor: 'transparent' },
        true: {
          backgroundColor: theme.colors.actionSoft,
          borderLeftColor: theme.colors.onActionSoft,
        },
      },
    },
  },
  label: {
    ...theme.typography.body,
    flexShrink: 1,
    variants: {
      isActive: {
        false: { color: theme.colors.text },
        true: { color: theme.colors.onActionSoft, fontWeight: '700' },
      },
    },
  },
  list: {
    // At least the menu's height, so the bottom entries reach its bottom.
    flexGrow: 1,
    gap: theme.gap(1),
    padding: theme.gap(3),
  },
  top: {
    flexGrow: 1,
    gap: theme.gap(1),
  },
}));
