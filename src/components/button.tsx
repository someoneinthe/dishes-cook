import { Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { IconName } from './icon';
import { Icon } from './icon';

type ButtonProps = Readonly<
  {
    accessibilityHint?: string;
    // Defaults to the visible label.
    accessibilityLabel?: string;
    isDisabled?: boolean;
    label: string;
    onPress: () => void;
  } & (
    | {
        // Deletions always show an icon (e.g. `trash-can-outline`).
        icon: IconName;
        // Destructive actions (delete): red.
        variant: 'danger';
      }
    | {
        // Shown before the label (CONTRIBUTING › Buttons): when it helps, on primary actions.
        icon?: IconName;
        // `primary`: the main action of a screen (blue); `secondary`: other actions (outlined).
        variant?: 'primary' | 'secondary';
      }
  )
>;

export function Button({
  accessibilityHint,
  accessibilityLabel,
  icon,
  isDisabled = false,
  label,
  onPress,
  variant = 'primary',
}: ButtonProps) {
  styles.useVariants({ variant });
  // The icon's color is a prop, not a style: read from the theme like the label's.
  const { theme } = useUnistyles();
  const contentColor = {
    danger: theme.colors.onAction,
    primary: theme.colors.onAction,
    secondary: theme.colors.text,
  }[variant];

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || isDisabled) && styles.dimmed]}
    >
      {icon && <Icon color={contentColor} name={icon} size={theme.iconSize.md} />}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
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
      variant: {
        danger: {
          backgroundColor: theme.colors.actionDanger,
          borderColor: theme.colors.actionDanger,
        },
        primary: {
          backgroundColor: theme.colors.actionPrimary,
          borderColor: theme.colors.actionPrimary,
        },
        secondary: { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
      },
    },
  },
  dimmed: {
    opacity: theme.opacity.disabled,
  },
  label: {
    ...theme.typography.label,
    variants: {
      variant: {
        danger: { color: theme.colors.onAction },
        primary: { color: theme.colors.onAction },
        secondary: { color: theme.colors.text },
      },
    },
  },
}));
