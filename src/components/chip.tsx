import { Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { IconName } from './icon';
import { Icon } from './icon';

type ChipProps = Readonly<{
  accessibilityHint?: string;
  // Defaults to the visible label.
  accessibilityLabel?: string;
  // Shown before the label, like on every button (e.g. "plus" to add, "close" to remove).
  icon: IconName;
  isSelected?: boolean;
  label: string;
  onPress: () => void;
}>;

export function Chip({
  accessibilityHint,
  accessibilityLabel,
  icon,
  isSelected = false,
  label,
  onPress,
}: ChipProps) {
  styles.useVariants({ isSelected });
  // The icon's color is a prop, not a style: read from the theme like the label's.
  const { theme } = useUnistyles();

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Icon
        color={isSelected ? theme.colors.onPrimary : theme.colors.text}
        name={icon}
        size={theme.iconSize.sm}
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
