import type { Ref } from 'react';
import type { ViewInstance } from 'react-native';
import { use } from 'react';
import { Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { usePreferences } from '@/features/settings/preferences';
import { isTv } from '@/lib/device';
import type { IconName } from './icon';
import { Icon } from './icon';
import { MenuContext } from './menu-context';
import { useFocusRing } from './use-focus-ring';
import { useIconSize } from './use-icon-size';

type ButtonProps = Readonly<
  {
    accessibilityHint?: string;
    // Defaults to the visible label.
    accessibilityLabel?: string;
    isDisabled?: boolean;
    // For a button that shows or hides a section: read as expanded or collapsed.
    isExpanded?: boolean;
    // Grows to fill its row (a wrapping row of buttons): rows line up at both edges, and the buttons
    // of a row are as tall as the tallest.
    isFilling?: boolean;
    // With `isIconOnly`, the label stays hidden even with Settings › "Show button labels" (and in a
    // ⋮ menu): where it has no room.
    isLabelAlwaysHidden?: boolean;
    // Takes the remote's focus on a TV when it turns true, its view being on screen. Ignored on a
    // phone: it would make the button focusable by touch, so a first tap would focus it instead of
    // pressing it.
    isTvPreferredFocus?: boolean;
    // Read by screen readers; shown unless `isIconOnly`.
    label: string;
    onPress: () => void;
    // To give it the screen reader's focus (e.g. back on Rename once a rename ends).
    ref?: Ref<ViewInstance>;
  } & (
    | {
        // Deletions always show an icon (e.g. `trash-can-outline`).
        icon: IconName;
        isIconOnly?: boolean;
        // Destructive actions (delete): red.
        variant: 'danger';
      }
    | {
        // Shown before the label (CONTRIBUTING › Buttons): when it helps, on primary actions.
        icon?: IconName;
        isIconOnly?: false;
        // `primary`: the main action of a screen (blue); `secondary`: other actions (outlined);
        // `active`: a secondary action whose option is on (light blue tint).
        variant?: 'active' | 'primary' | 'secondary';
      }
    | {
        icon: IconName;
        // Only the icon is shown (edit, delete…): the label stays for screen readers.
        isIconOnly: true;
        variant?: 'active' | 'primary' | 'secondary';
      }
  )
>;

export function Button({
  accessibilityHint,
  accessibilityLabel,
  icon,
  isDisabled = false,
  isExpanded,
  isFilling = false,
  isIconOnly = false,
  isLabelAlwaysHidden,
  isTvPreferredFocus = false,
  label,
  onPress,
  ref,
  variant = 'primary',
}: ButtonProps) {
  // Settings › "Show button labels" brings the text back on icon-only buttons.
  const { isShowingButtonLabels } = usePreferences();
  // In a header's ⋮ menu: labeled, and pressing it closes the menu.
  const closeMenu = use(MenuContext);
  const isLabelHidden = isOnlyIconShown({
    isIconOnly,
    isInMenu: closeMenu !== undefined,
    isLabelAlwaysHidden,
    isShowingButtonLabels,
  });
  styles.useVariants({ isIconOnly: isLabelHidden, variant });
  // The icon's color is a prop, not a style: read from the theme like the label's.
  const { theme } = useUnistyles();
  const iconSize = useIconSize('md');
  const { focusProps, focusStyle } = useFocusRing();
  const contentColor = {
    active: theme.colors.onActionSoft,
    danger: theme.colors.onAction,
    primary: theme.colors.onAction,
    secondary: theme.colors.text,
  }[variant];

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, expanded: isExpanded }}
      disabled={isDisabled}
      // Android requests the focus when this turns true (the typings only mention Apple TV).
      // eslint-disable-next-line sonarjs/deprecation
      hasTVPreferredFocus={isTv && isTvPreferredFocus}
      onPress={closingMenu(onPress, closeMenu)}
      ref={ref}
      {...focusProps}
      style={({ pressed }) => [
        styles.button,
        isFilling && styles.filling,
        (pressed || isDisabled) && styles.dimmed,
        focusStyle,
      ]}
    >
      {icon && <Icon color={contentColor} name={icon} size={iconSize} />}
      {!isLabelHidden && <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

// `onPress`, closing the menu the button is in first, if any.
function closingMenu(onPress: () => void, closeMenu: (() => void) | undefined): () => void {
  return closeMenu
    ? () => {
        closeMenu();
        onPress();
      }
    : onPress;
}

const styles = StyleSheet.create((theme) => ({
  button: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    flexDirection: 'row',
    gap: theme.gap(2),
    justifyContent: 'center',
    minHeight: theme.size.touchTarget,
    paddingHorizontal: theme.gap(4),
    paddingVertical: theme.gap(2),
    variants: {
      // A square as tall as the other buttons.
      isIconOnly: {
        true: { minWidth: theme.size.touchTarget, paddingHorizontal: theme.gap(2) },
      },
      variant: {
        active: {
          backgroundColor: theme.colors.actionSoft,
          borderColor: theme.colors.onActionSoft,
        },
        danger: {
          backgroundColor: theme.colors.actionDanger,
          borderColor: theme.colors.actionDanger,
        },
        primary: {
          backgroundColor: theme.colors.actionPrimary,
          borderColor: theme.colors.actionPrimary,
        },
        secondary: {
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.borderStrong,
        },
      },
    },
  },
  dimmed: {
    opacity: theme.opacity.disabled,
  },
  filling: {
    flexGrow: 1,
  },
  label: {
    ...theme.typography.label,
    variants: {
      variant: {
        active: { color: theme.colors.onActionSoft },
        danger: { color: theme.colors.onAction },
        primary: { color: theme.colors.onAction },
        secondary: { color: theme.colors.text },
      },
    },
  },
}));

// Whether an icon-only button shows only its icon: not with Settings › "Show button labels", nor in a
// ⋮ menu, unless its label has no room.
function isOnlyIconShown(
  options: Readonly<{
    isIconOnly: boolean;
    isInMenu: boolean;
    isLabelAlwaysHidden: boolean | undefined;
    isShowingButtonLabels: boolean;
  }>,
): boolean {
  const { isIconOnly, isInMenu, isLabelAlwaysHidden = false, isShowingButtonLabels } = options;
  return isIconOnly && (isLabelAlwaysHidden || (!isShowingButtonLabels && !isInMenu));
}
