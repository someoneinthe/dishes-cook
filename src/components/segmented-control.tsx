import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { ColorToken } from '@/theme/themes';
import { usePreferences } from '@/features/settings/preferences';
import { useMessages } from '@/i18n/i18n-provider';
import type { IconName } from './icon';
import { Icon } from './icon';
import { useFocusRing } from './use-focus-ring';
import { useIconSize } from './use-icon-size';

export type SegmentedOption<T extends string> = Readonly<{
  // Shown before the label (e.g. a snowflake for winter).
  icon?: IconName;
  // The icon's own color (text color by default); white on the selected option.
  iconColor?: ColorToken;
  label: string;
  value: T;
}>;

type SegmentedControlProps<T extends string> = Readonly<{
  // A small switch attached under a field (TextField's `attachment`): as wide as its options, on
  // the right, against the field (top corners square, the borders shared).
  isAttached?: boolean;
  // Icons only, like icon-only buttons: their text shows with Settings › Show button labels, and
  // screen readers always read it. Every option then needs an icon.
  isIconOnly?: boolean;
  // The visible label is left out (the field it belongs to shows it); screen readers still read it.
  isLabelHidden?: boolean;
  label: string;
  onChange: (value: T) => void;
  optionList: readonly SegmentedOption<T>[];
  value: T;
}>;

type SegmentProps<T extends string> = Readonly<{
  groupLabel: string;
  isAttached: boolean;
  isChecked: boolean;
  isTextShown: boolean;
  onPress: () => void;
  option: SegmentedOption<T>;
}>;

// An attached switch's options are small (28 dp high): they still answer taps down to a touch
// target's height (48 dp), under them (above is the field).
const ATTACHED_HEIGHT = 28;
const ATTACHED_HIT_SLOP = { bottom: 48 - ATTACHED_HEIGHT } as const;

// A single choice among a few options, shown side by side (radio group semantics).
export function SegmentedControl<T extends string>({
  isAttached = false,
  isIconOnly = false,
  isLabelHidden = false,
  label,
  onChange,
  optionList,
  value,
}: SegmentedControlProps<T>) {
  const t = useMessages();
  const { isShowingButtonLabels } = usePreferences();

  return (
    <View style={[styles.field, isAttached && styles.attachedField]}>
      {/* The group reads its label itself: screen readers skip the visible copy. */}
      {!isLabelHidden && (
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.label}>
          {label}
        </Text>
      )}
      <View
        accessibilityHint={t.common.chooseOneOption}
        accessibilityLabel={label}
        accessibilityRole="radiogroup"
        style={[styles.group, isAttached && styles.attachedGroup]}
      >
        {optionList.map((option) => (
          <Segment
            groupLabel={label}
            isAttached={isAttached}
            isChecked={option.value === value}
            isTextShown={!isIconOnly || isShowingButtonLabels}
            key={option.value}
            onPress={() => onChange(option.value)}
            option={option}
          />
        ))}
      </View>
    </View>
  );
}

// One option of the group.
function Segment<T extends string>({
  groupLabel,
  isAttached,
  isChecked,
  isTextShown,
  onPress,
  option,
}: SegmentProps<T>) {
  // Icon colors are props, not styles.
  const { theme } = useUnistyles();
  const iconSize = useIconSize('sm');
  const t = useMessages();
  // Inside the option: the group clips its rounded corners.
  const { focusProps, focusStyle } = useFocusRing({ isInset: true, isOnAction: isChecked });

  return (
    <Pressable
      accessibilityHint={t.common.setsChoice(groupLabel, option.label)}
      accessibilityLabel={option.label}
      accessibilityRole="radio"
      accessibilityState={{ checked: isChecked }}
      hitSlop={isAttached ? ATTACHED_HIT_SLOP : undefined}
      onPress={onPress}
      {...focusProps}
      style={[
        styles.segment,
        isAttached && styles.attachedSegment,
        isChecked && styles.checkedSegment,
        focusStyle,
      ]}
    >
      {option.icon && (
        <Icon
          color={isChecked ? theme.colors.onAction : theme.colors[option.iconColor ?? 'text']}
          name={option.icon}
          size={iconSize}
        />
      )}
      {isTextShown && (
        <Text style={[styles.segmentLabel, isChecked && styles.checkedLabel]}>{option.label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  attachedField: {
    alignSelf: 'flex-end',
  },
  attachedGroup: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    // One border between the field and the switch.
    marginTop: -theme.borderWidth,
  },
  // Small: a little tab when it shows its icon only (its touch area reaches the touch target's
  // height below it: ATTACHED_HIT_SLOP).
  attachedSegment: {
    flexGrow: 0,
    minHeight: ATTACHED_HEIGHT,
    minWidth: ATTACHED_HEIGHT + theme.gap(2),
    paddingHorizontal: theme.gap(1),
  },
  checkedLabel: {
    color: theme.colors.onAction,
  },
  checkedSegment: {
    backgroundColor: theme.colors.actionPrimary,
  },
  field: {
    gap: theme.gap(1),
  },
  group: {
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    flexDirection: 'row',
    // Options that don't fit side by side (long labels, large fonts) go on another line instead of
    // being cut.
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    // As wide as its content, sharing the rest of the line.
    flexBasis: 'auto',
    flexDirection: 'row',
    flexGrow: 1,
    // Never narrower than its content: an option that doesn't fit goes on the next line.
    flexShrink: 0,
    gap: theme.gap(1),
    justifyContent: 'center',
    minHeight: theme.size.touchTarget,
    paddingHorizontal: theme.gap(2),
  },
  segmentLabel: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
}));
