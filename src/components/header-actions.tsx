import type { ReactNode, Ref } from 'react';
import type { LayoutChangeEvent, View as ViewType } from 'react-native';
import { useRef, useState } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';
import { Button } from './button';
import { MenuContext } from './menu-context';

// Where a ⋮ menu opens: under its button, in window coordinates.
type Anchor = Readonly<{ right: number; top: number }>;

// What the header shows: every button, `children` and ⋮, or ⋮ alone.
type Fit = 'all' | 'children' | 'menu';

type HeaderActionsProps = Readonly<{
  children: ReactNode;
  // Other actions, before `children` when the header has room for them, else in a ⋮ menu (and
  // `children` too when even they don't fit): the back button and the title always stay.
  more?: ReactNode;
}>;

// Widths of the buttons as they'd be shown in the header: `children`, `more`, and the ⋮ button,
// labeled as other buttons are and as an icon only.
type Widths = Readonly<{ children: number; menuButton: number; menuIcon: number; more: number }>;

// The buttons of a screen, at the top right of its header (`headerRight` option).
export function HeaderActions({ children, more }: HeaderActionsProps) {
  // Sonar (S100) only sees a component when it returns a JSX element, not a ternary.
  // eslint-disable-next-line unicorn/prefer-ternary
  if (more === undefined) {
    return <View style={styles.row}>{children}</View>;
  }
  return <FittingHeaderActions more={more}>{children}</FittingHeaderActions>;
}

// `headerRight` option showing `children` (and `more`, see HeaderActions) at the top right of the
// header. Built here, outside the screens, so screens don't define a component while rendering
// (Sonar S6478).
export function headerActions(children: ReactNode, more?: ReactNode) {
  return function HeaderRight() {
    return <HeaderActions more={more}>{children}</HeaderActions>;
  };
}

// The buttons that fit, the others in a ⋮ menu. Their widths depend on the labels (Settings ›
// "Show button labels"), the language and the font size: an invisible copy of them is measured.
function FittingHeaderActions({
  children,
  more,
}: Readonly<{ children: ReactNode; more: ReactNode }>) {
  const { theme } = useUnistyles();
  const { width: windowWidth } = useWindowDimensions();
  const [widths, setWidths] = useState<Partial<Widths>>({});
  const [anchor, setAnchor] = useState<Anchor>();
  const menuButtonRef = useRef<ViewType>(null);
  const measure = (key: keyof Widths) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setWidths((previous) => (previous[key] === width ? previous : { ...previous, [key]: width }));
  };
  // The back button and the start of the title (its icon and a few letters), then the row's
  // padding.
  const room = windowWidth - theme.size.touchTarget * 3 - theme.gap(3);
  // Labeled (Settings › "Show button labels"), ⋮ may not fit alone: then it's an icon only, and
  // what fits is worked out with that width.
  const isMenuLabelHidden = (widths.menuButton ?? 0) > room;
  const fit = toFit(
    { ...widths, menuButton: isMenuLabelHidden ? widths.menuIcon : widths.menuButton },
    { gap: theme.gap(2), room },
  );
  const openMenu = () => {
    menuButtonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ right: windowWidth - x - width, top: y + height + theme.gap(1) });
    });
  };
  const closeMenu = () => setAnchor(undefined);

  return (
    <View style={styles.row}>
      {/* Measured only: hidden from sight, touch and screen readers. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.measured}
      >
        <View onLayout={measure('more')} style={styles.group} testID="measured-more">
          {more}
        </View>
        <View onLayout={measure('children')} style={styles.group} testID="measured-children">
          {children}
        </View>
        <View onLayout={measure('menuButton')} style={styles.group} testID="measured-menuButton">
          <MenuButton onPress={() => {}} />
        </View>
        <View onLayout={measure('menuIcon')} style={styles.group} testID="measured-menuIcon">
          <MenuButton isLabelHidden onPress={() => {}} />
        </View>
      </View>
      {fit === 'all' && more}
      {fit !== 'menu' && children}
      {fit !== 'all' && (
        <MenuButton isLabelHidden={isMenuLabelHidden} onPress={openMenu} ref={menuButtonRef} />
      )}
      {anchor && (
        <Modal
          animationType="fade"
          onRequestClose={closeMenu}
          statusBarTranslucent
          transparent
          visible
        >
          {/* A tap outside closes it; screen readers use Back instead. */}
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={closeMenu}
            style={styles.backdrop}
          />
          <View accessibilityViewIsModal style={[styles.menu, anchor]}>
            <MenuContext value={closeMenu}>
              {more}
              {fit === 'menu' && children}
            </MenuContext>
          </View>
        </Modal>
      )}
    </View>
  );
}

// The ⋮ button, opening the menu of the actions that don't fit.
function MenuButton({
  isLabelHidden = false,
  onPress,
  ref,
}: Readonly<{ isLabelHidden?: boolean; onPress: () => void; ref?: Ref<ViewType> }>) {
  const t = useMessages();

  return (
    <Button
      accessibilityHint={t.common.moreHint}
      icon="dots-vertical"
      isIconOnly
      isLabelAlwaysHidden={isLabelHidden}
      label={t.common.more}
      onPress={onPress}
      ref={ref}
      variant="secondary"
    />
  );
}

// What fits in `room`: every button, else `children` and ⋮, else ⋮ alone. Every button until
// they're measured: they usually fit.
function toFit(
  widths: Partial<Omit<Widths, 'menuIcon'>>,
  { gap, room }: Readonly<{ gap: number; room: number }>,
): Fit {
  const { children, menuButton, more } = widths;
  if (
    children === undefined ||
    menuButton === undefined ||
    more === undefined ||
    more + gap + children <= room
  ) {
    return 'all';
  }
  return children + gap + menuButton <= room ? 'children' : 'menu';
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  group: {
    flexDirection: 'row',
    gap: theme.gap(2),
  },
  // Wide enough for the buttons to keep their size, whatever the header's.
  measured: {
    flexDirection: 'row',
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
    width: 10_000,
  },
  menu: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    boxShadow: [
      {
        blurRadius: theme.gap(2),
        color: theme.colors.overlay,
        offsetX: 0,
        offsetY: theme.gap(0.5),
      },
    ],
    gap: theme.gap(2),
    maxWidth: '90%',
    padding: theme.gap(2),
    position: 'absolute',
  },
  row: {
    flexDirection: 'row',
    // The title is truncated first: buttons keep their size, even with large system fonts.
    flexShrink: 0,
    gap: theme.gap(2),
    paddingRight: theme.gap(3),
  },
}));
