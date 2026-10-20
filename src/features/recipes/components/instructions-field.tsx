import { useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import { Markdown } from '@/components/markdown';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { useMessages } from '@/i18n/i18n-provider';

type InstructionsFieldProps = Readonly<{
  onChange: (instructions: string) => void;
  // A dish's or a drink's (src/features/recipes/kind.ts).
  placeholder: string;
  value: string;
}>;

type Mode = 'preview' | 'write';

// The recipe text, written in Markdown: "Write" edits it as typed, "Preview" shows it formatted
// like on the recipe screen. The switch is attached under the field, on its right, icons only
// (their text shows with Settings › Show button labels).
export function InstructionsField({ onChange, placeholder, value }: InstructionsFieldProps) {
  const t = useMessages();
  const [mode, setMode] = useState<Mode>('write');
  // The height the field had in Write: Preview keeps at least it, so switching moves nothing.
  const [writeHeight, setWriteHeight] = useState(0);
  const modeOptionList: readonly SegmentedOption<Mode>[] = [
    { icon: 'pencil-outline', label: t.recipes.write, value: 'write' },
    { icon: 'eye-outline', label: t.recipes.preview, value: 'preview' },
  ];
  const modeSwitch = (
    <SegmentedControl
      isAttached
      isIconOnly
      isLabelHidden
      label={t.recipes.recipe}
      onChange={setMode}
      optionList={modeOptionList}
      value={mode}
    />
  );

  return (
    <View style={styles.field}>
      {/* The field reads its own label: screen readers skip the visible copy. */}
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.label}>
        {t.recipes.recipe}
      </Text>
      <View
        onLayout={(event) => {
          if (mode === 'write') {
            setWriteHeight(event.nativeEvent.layout.height);
          }
        }}
        style={mode === 'preview' && { minHeight: writeHeight }}
      >
        {mode === 'write' ? (
          <TextField
            attachment={modeSwitch}
            hint={t.recipes.formatHint}
            isLabelHidden
            label={t.recipes.recipeText}
            multiline
            onChangeText={onChange}
            placeholder={placeholder}
            value={value}
          />
        ) : (
          // Laid out like the text field (switch, then the format help), so switching doesn't move it.
          <View style={styles.previewField}>
            <View style={styles.previewFrame}>
              <View style={styles.preview}>
                {value.trim() ? (
                  <Markdown text={value} />
                ) : (
                  <Text style={styles.muted}>{t.recipes.nothingToPreview}</Text>
                )}
              </View>
              {modeSwitch}
            </View>
            <Text style={styles.hint}>{t.recipes.formatHint}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  field: {
    gap: theme.gap(2),
  },
  // As TextField shows its help.
  hint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  muted: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  // Same frame as the text field, so switching doesn't make the screen jump.
  preview: {
    borderBottomRightRadius: 0,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    flexGrow: 1,
    minHeight: theme.size.multilineInput,
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(2),
  },
  // As TextField's own layout: the field, then its help. It grows to the Write height (the help
  // stays at the bottom, where it was), and so do the frame and the preview in it.
  previewField: {
    flexGrow: 1,
    gap: theme.gap(1),
  },
  previewFrame: {
    flexGrow: 1,
  },
}));
