import type { TextInputProps } from 'react-native';
import { Text, TextInput, View } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';

// TextInput's placeholder color isn't a style: Unistyles maps it from the theme.
const ThemedTextInput = withUnistyles(TextInput, (theme) => ({
  placeholderTextColor: theme.colors.textMuted,
}));

type TextFieldProps = Readonly<
  Pick<
    TextInputProps,
    | 'autoCapitalize'
    | 'autoFocus'
    | 'multiline'
    | 'onChangeText'
    | 'onSubmitEditing'
    | 'placeholder'
    | 'returnKeyType'
    | 'submitBehavior'
    | 'value'
  > & {
    error?: string;
    // Hidden labels are still read by screen readers.
    isLabelHidden?: boolean;
    label: string;
  }
>;

export function TextField({
  error,
  isLabelHidden = false,
  label,
  multiline,
  ...inputProps
}: TextFieldProps) {
  return (
    <View style={styles.field}>
      {!isLabelHidden && <Text style={styles.label}>{label}</Text>}
      <ThemedTextInput
        // The error, if any, is read after the label.
        accessibilityHint={error}
        accessibilityLabel={label}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, error !== undefined && styles.invalid]}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...inputProps}
      />
      {error !== undefined && (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
  field: {
    gap: theme.gap(1),
  },
  input: {
    ...theme.typography.body,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    color: theme.colors.text,
    minHeight: theme.size.touchTarget,
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(2),
  },
  invalid: {
    borderColor: theme.colors.danger,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  multiline: {
    minHeight: theme.size.multilineInput,
  },
}));
