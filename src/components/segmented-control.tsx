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
  isFirst: boolean;
  isLast: boolean;
  isTextShown: boolean;
  onPress: () => void;
  option: SegmentedOption<T>;
}>;

// An attached switch's options look small (28 dp high), each inside a touch target (48 dp) that
// reaches below it: a Pressable only answers within its parent, so the touch area is real.
const ATTACHED_HEIGHT = 28;

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
        style={isAttached ? styles.attachedGroup : styles.group}
      >
        {optionList.map((option, index) => (
          <Segment
            groupLabel={label}
            isAttached={isAttached}
            isChecked={option.value === value}
            isFirst={index === 0}
            isLast={index === optionList.length - 1}
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

// An attached tab's own frame: its place among its neighbours.
function attachedTabStyle(isFirst: boolean, isLast: boolean) {
  return [
    styles.attachedTab,
    isFirst ? styles.attachedTabFirst : styles.attachedTabAfterFirst,
    isLast && styles.attachedTabLast,
  ];
}

// One option of the group.
function Segment<T extends string>({
  groupLabel,
  isAttached,
  isChecked,
  isFirst,
  isLast,
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

  const content = (
    <>
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
    </>
  );

  return (
    <Pressable
      accessibilityHint={t.common.setsChoice(groupLabel, option.label)}
      accessibilityLabel={option.label}
      accessibilityRole="radio"
      accessibilityState={{ checked: isChecked }}
      onPress={onPress}
      {...focusProps}
      style={
        isAttached
          ? styles.attachedTouchArea
          : [styles.segment, isChecked && styles.checkedSegment, focusStyle]
      }
    >
      {isAttached ? (
        // The visible tab, at the top of its touch area; its borders join the field's and its
        // neighbour's, its outer bottom corner rounded.
        <View
          style={[
            attachedTabStyle(isFirst, isLast),
            isChecked && styles.checkedSegment,
            focusStyle,
          ]}
        >
          {content}
        </View>
      ) : (
        content
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  attachedField: {
    alignSelf: 'flex-end',
  },
  attachedGroup: {
    flexDirection: 'row',
    // One border between the field and the switch.
    marginTop: -theme.borderWidth,
  },
  attachedTab: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderWidth: theme.borderWidth,
    flexDirection: 'row',
    gap: theme.gap(1),
    justifyContent: 'center',
    minHeight: ATTACHED_HEIGHT,
    paddingHorizontal: theme.gap(2),
  },
  // Its left border is its neighbour's right one.
  attachedTabAfterFirst: {
    marginLeft: -theme.borderWidth,
  },
  attachedTabFirst: {
    borderBottomLeftRadius: theme.radius.md,
  },
  attachedTabLast: {
    borderBottomRightRadius: theme.radius.md,
  },
  // A touch target (48 dp) around the small tab, which sits at its top.
  attachedTouchArea: {
    justifyContent: 'flex-start',
    minHeight: theme.size.touchTarget,
    minWidth: theme.size.touchTarget,
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
