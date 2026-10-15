import { Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { IconName } from './icon';
import { Icon } from './icon';
import { useFocusRing } from './use-focus-ring';
import { useIconSize } from './use-icon-size';

type ChipProps = Readonly<{
  accessibilityHint?: string;
  // Defaults to the visible label.
  accessibilityLabel?: string;
  // Shown before the label, like on every button (e.g. "plus" to add, "close" to remove).
  icon: IconName;
  isSelected?: boolean;
  // Takes the remote's focus on a TV when it turns true, its view being on screen. Never on a phone:
  // it makes the chip focusable by touch, so a first tap would focus it instead of pressing it.
  isTvPreferredFocus?: boolean;
  label: string;
  onPress: () => void;
}>;

export function Chip({
  accessibilityHint,
  accessibilityLabel,
  icon,
  isSelected = false,
  isTvPreferredFocus = false,
  label,
  onPress,
}: ChipProps) {
  styles.useVariants({ isSelected });
  // The icon's color is a prop, not a style: read from the theme like the label's.
  const { theme } = useUnistyles();
  const iconSize = useIconSize('sm');
  const { focusProps, focusStyle } = useFocusRing();

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      // Android requests the focus when this turns true (the typings only mention Apple TV).
      // eslint-disable-next-line sonarjs/deprecation
      hasTVPreferredFocus={isTvPreferredFocus}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed, focusStyle]}
    >
      <Icon
        color={isSelected ? theme.colors.onAction : theme.colors.text}
        name={icon}
        size={iconSize}
      />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth,
    flexDirection: 'row',
    gap: theme.gap(1),
    justifyContent: 'center',
    minHeight: theme.size.chip,
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(1),
    variants: {
      isSelected: {
        false: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        true: {
          backgroundColor: theme.colors.actionPrimary,
          borderColor: theme.colors.actionPrimary,
        },
      },
    },
  },
  label: {
    ...theme.typography.caption,
    variants: {
      isSelected: {
        false: { color: theme.colors.text },
        true: { color: theme.colors.onAction },
      },
    },
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
