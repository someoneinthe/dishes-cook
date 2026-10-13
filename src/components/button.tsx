import { Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { IconName } from './icon';
import { Icon } from './icon';

type ButtonProps = Readonly<{
  accessibilityHint?: string;
  // Defaults to the visible label.
  accessibilityLabel?: string;
  // Every button shows an icon before its label (CONTRIBUTING › Buttons).
  icon: IconName;
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
  // `danger`: destructive actions (delete), red background.
  variant?: Variant;
}>;

type Variant = 'danger' | 'primary' | 'secondary';

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
    danger: theme.colors.onDanger,
    primary: theme.colors.onPrimary,
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
      <Icon color={contentColor} name={icon} size={theme.iconSize.md} />
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
        danger: { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger },
        primary: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
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
        danger: { color: theme.colors.onDanger },
        primary: { color: theme.colors.onPrimary },
        secondary: { color: theme.colors.text },
      },
    },
  },
}));
