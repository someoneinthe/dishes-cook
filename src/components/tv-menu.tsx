import type { DrawerContentComponentProps } from 'expo-router/drawer';
import type { ReactNode } from 'react';
import { DrawerContentScrollView } from 'expo-router/drawer';
import { StyleSheet as NativeStyleSheet, Pressable, Text, useWindowDimensions } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';
import { useFocusRing } from './use-focus-ring';
import { useIconSize } from './use-icon-size';

type TvMenuEntryProps = Readonly<{
  icon: ReactNode;
  isActive: boolean;
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
            key={route.key}
            label={options.title}
            onPress={() => navigation.navigate(route.name)}
          />
        );
      })}
    </DrawerContentScrollView>
  );
}

function TvMenuEntry({ icon, isActive, label, onPress }: TvMenuEntryProps) {
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
      onPress={onPress}
      {...focusProps}
      style={[styles.entry, focusStyle]}
    >
      {icon}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  entry: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.gap(3),
    minHeight: theme.size.touchTarget,
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(2),
    variants: {
      // The current screen: a light tint, like other options that are on.
      isActive: {
        true: { backgroundColor: theme.colors.actionSoft },
      },
    },
  },
  label: {
    ...theme.typography.body,
    flexShrink: 1,
    variants: {
      isActive: {
        false: { color: theme.colors.text },
        true: { color: theme.colors.onActionSoft },
      },
    },
  },
  list: {
    gap: theme.gap(1),
    padding: theme.gap(3),
  },
}));
