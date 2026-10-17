import type { Ref } from 'react';
import type { TextInputProps } from 'react-native';
import { Text, TextInput, View } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { isTv } from '@/lib/device';
import { useFocusRing } from './use-focus-ring';

// TextInput's placeholder color isn't a style: Unistyles maps it from the theme.
const ThemedTextInput = withUnistyles(TextInput, (theme) => ({
  placeholderTextColor: theme.colors.textMuted,
}));

type TextFieldProps = Readonly<
  Pick<
    TextInputProps,
    | 'autoCapitalize'
    | 'autoComplete'
    | 'autoCorrect'
    | 'autoFocus'
    | 'editable'
    | 'keyboardType'
    | 'multiline'
    | 'onChangeText'
    | 'onSubmitEditing'
    | 'placeholder'
    | 'returnKeyType'
    | 'secureTextEntry'
    | 'submitBehavior'
    | 'textContentType'
    | 'value'
  > & {
    error?: string;
    // An error the caller shows elsewhere (e.g. under a whole row): a red border, and read with the
    // field by screen readers, like `error`.
    externalError?: string;
    // Help shown under the field (e.g. the accepted format).
    hint?: string;
    // Hidden labels are still read by screen readers.
    isLabelHidden?: boolean;
    label: string;
    // To move the focus to the field (e.g. the first invalid one on Save).
    ref?: Ref<TextInput>;
  }
>;

export function TextField({
  error,
  externalError,
  hint,
  isLabelHidden = false,
  label,
  multiline,
  ...inputProps
}: TextFieldProps) {
  const { focusProps, focusStyle } = useFocusRing();
  const shownError = error ?? externalError;

  return (
    <View style={styles.field}>
      {/* The field reads its label and help itself: screen readers skip the visible copies. */}
      {!isLabelHidden && (
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.label}>
          {label}
        </Text>
      )}
      <ThemedTextInput
        // Read after the label: the error if any, else the help shown under the field.
        accessibilityHint={shownError ?? hint}
        accessibilityLabel={label}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.multiline,
          shownError !== undefined && styles.invalid,
          // On a TV, the remote's focus ring; a phone shows the cursor and the keyboard instead.
          isTv && focusStyle,
        ]}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...focusProps}
        {...inputProps}
      />
      {hint !== undefined && (
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.hint}>
          {hint}
        </Text>
      )}
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
  hint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  input: {
    ...theme.typography.body,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
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
