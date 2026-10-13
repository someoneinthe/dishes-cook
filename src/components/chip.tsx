import { Pressable, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type ChipProps = Readonly<{
  accessibilityHint?: string;
  // Defaults to the visible label.
  accessibilityLabel?: string;
  isSelected?: boolean;
  label: string;
  onPress: () => void;
}>;

export function Chip({
  accessibilityHint,
  accessibilityLabel,
  isSelected = false,
  label,
  onPress,
}: ChipProps) {
  styles.useVariants({ isSelected });

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth,
    justifyContent: 'center',
    minHeight: theme.size.chip,
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(1),
    variants: {
      isSelected: {
        false: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        true: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
      },
    },
  },
  label: {
    ...theme.typography.caption,
    variants: {
      isSelected: {
        false: { color: theme.colors.text },
        true: { color: theme.colors.onPrimary },
      },
    },
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
