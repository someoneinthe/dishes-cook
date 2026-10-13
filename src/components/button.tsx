import { Pressable, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type ButtonProps = Readonly<{
  accessibilityHint?: string;
  // Defaults to the visible label.
  accessibilityLabel?: string;
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'danger' | 'primary' | 'secondary';
}>;

export function Button({
  accessibilityHint,
  accessibilityLabel,
  isDisabled = false,
  label,
  onPress,
  variant = 'primary',
}: ButtonProps) {
  styles.useVariants({ variant });

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
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    justifyContent: 'center',
    minHeight: theme.size.touchTarget,
    paddingHorizontal: theme.gap(4),
    paddingVertical: theme.gap(2),
    variants: {
      variant: {
        danger: { backgroundColor: theme.colors.background, borderColor: theme.colors.danger },
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
        danger: { color: theme.colors.danger },
        primary: { color: theme.colors.onPrimary },
        secondary: { color: theme.colors.text },
      },
    },
  },
}));
