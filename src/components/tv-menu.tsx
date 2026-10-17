import type { DrawerContentComponentProps } from 'expo-router/drawer';
import type { ReactNode } from 'react';
import { DrawerContentScrollView } from 'expo-router/drawer';
import { useState } from 'react';
import { StyleSheet as NativeStyleSheet, Pressable, Text, useWindowDimensions } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';
import { useFocusRing } from './use-focus-ring';
import { useIconSize } from './use-icon-size';

type TvMenuEntryProps = Readonly<{
  icon: ReactNode;
  isActive: boolean;
  // Takes the remote's focus when it turns true (back from the screen this entry opened).
  isTvPreferredFocus: boolean;
  label: string;
  onPress: () => void;
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

  return (
    <DrawerContentScrollView contentContainerStyle={styles.list}>
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options;
        const isHidden = NativeStyleSheet.flatten(options?.drawerItemStyle)?.display === 'none';
        if (isHidden || !options?.title) {
          return null;
        }
        const isActive = index === state.index;
        const color = isActive ? theme.colors.onActionSoft : theme.colors.text;
        return (
          <TvMenuEntry
            icon={options.drawerIcon?.({ color, focused: isActive, size: iconSize })}
            isActive={isActive}
            isTvPreferredFocus={route.key === focusReturnKey}
            key={route.key}
            label={options.title}
            onPress={() => {
              openFromMenu(route.key);
              navigation.navigate(route.name);
            }}
          />
        );
      })}
    </DrawerContentScrollView>
  );
}

function TvMenuEntry({ icon, isActive, isTvPreferredFocus, label, onPress }: TvMenuEntryProps) {
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
    gap: theme.gap(1),
    padding: theme.gap(3),
  },
}));
