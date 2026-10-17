import { Pressable, Text, View } from 'react-native';
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
  // An option of a single choice (e.g. a unit): read as a radio button, checked or not, and filled
  // in blue while checked. Undefined for a chip that only acts (add, remove).
  isChecked?: boolean;
  // Filled in blue (e.g. an ingredient already in the recipe, which the chip removes), without being
  // read as selected.
  isFilled?: boolean;
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
  isChecked,
  isFilled = false,
  isTvPreferredFocus = false,
  label,
  onPress,
}: ChipProps) {
  const isShownFilled = isFilled || isChecked === true;
  styles.useVariants({ isFilled: isShownFilled });
  // The icon's color is a prop, not a style: read from the theme like the label's.
  const { theme } = useUnistyles();
  const iconSize = useIconSize('sm');
  const { focusProps, focusStyle } = useFocusRing();

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={isChecked === undefined ? 'button' : 'radio'}
      accessibilityState={isChecked === undefined ? undefined : { checked: isChecked }}
      // Android requests the focus when this turns true (the typings only mention Apple TV).
      // eslint-disable-next-line sonarjs/deprecation
      hasTVPreferredFocus={isTvPreferredFocus}
      onPress={onPress}
      {...focusProps}
      style={styles.touchArea}
    >
      {({ pressed }) => (
        <View style={[styles.chip, pressed && styles.pressed, focusStyle]}>
          <Icon
            color={isShownFilled ? theme.colors.onAction : theme.colors.text}
            name={icon}
            size={iconSize}
          />
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
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
      isFilled: {
        false: { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
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
      isFilled: {
        false: { color: theme.colors.text },
        true: { color: theme.colors.onAction },
      },
    },
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  // A touch target around the smaller chip: lists of chips put no space between their lines, the
  // touch areas' transparent edges doing it.
  touchArea: {
    justifyContent: 'center',
    minHeight: theme.size.touchTarget,
  },
}));
