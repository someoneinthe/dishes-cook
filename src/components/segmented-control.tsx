import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { ColorToken } from '@/theme/themes';
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
  label: string;
  onChange: (value: T) => void;
  optionList: readonly SegmentedOption<T>[];
  value: T;
}>;

type SegmentProps<T extends string> = Readonly<{
  groupLabel: string;
  isChecked: boolean;
  onPress: () => void;
  option: SegmentedOption<T>;
}>;

// A single choice among a few options, shown side by side (radio group semantics).
export function SegmentedControl<T extends string>({
  label,
  onChange,
  optionList,
  value,
}: SegmentedControlProps<T>) {
  const t = useMessages();

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        accessibilityHint={t.common.chooseOneOption}
        accessibilityLabel={label}
        accessibilityRole="radiogroup"
        style={styles.group}
      >
        {optionList.map((option) => (
          <Segment
            groupLabel={label}
            isChecked={option.value === value}
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
function Segment<T extends string>({ groupLabel, isChecked, onPress, option }: SegmentProps<T>) {
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
      onPress={onPress}
      {...focusProps}
      style={[styles.segment, isChecked && styles.checkedSegment, focusStyle]}
    >
      {option.icon && (
        <Icon
          color={isChecked ? theme.colors.onAction : theme.colors[option.iconColor ?? 'text']}
          name={option.icon}
          size={iconSize}
        />
      )}
      <Text style={[styles.segmentLabel, isChecked && styles.checkedLabel]}>{option.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
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
    borderColor: theme.colors.border,
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
