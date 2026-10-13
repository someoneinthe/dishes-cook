import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type SegmentedOption<T extends string> = Readonly<{ label: string; value: T }>;

type SegmentedControlProps<T extends string> = Readonly<{
  label: string;
  onChange: (value: T) => void;
  optionList: readonly SegmentedOption<T>[];
  value: T;
}>;

// A single choice among a few options, shown side by side (radio group semantics).
export function SegmentedControl<T extends string>({
  label,
  onChange,
  optionList,
  value,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        accessibilityHint="Choose one option"
        accessibilityLabel={label}
        accessibilityRole="radiogroup"
        style={styles.group}
      >
        {optionList.map((option) => {
          const isChecked = option.value === value;
          return (
            <Pressable
              accessibilityHint={`Sets ${label.toLowerCase()} to ${option.label.toLowerCase()}`}
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: isChecked }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.segment, isChecked && styles.checkedSegment]}
            >
              <Text style={[styles.segmentLabel, isChecked && styles.checkedLabel]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  checkedLabel: {
    color: theme.colors.onPrimary,
  },
  checkedSegment: {
    backgroundColor: theme.colors.primary,
  },
  field: {
    gap: theme.gap(1),
  },
  group: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.size.touchTarget,
    paddingHorizontal: theme.gap(2),
  },
  segmentLabel: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
}));
