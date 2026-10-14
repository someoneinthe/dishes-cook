import { useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import { Markdown } from '@/components/markdown';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';

type Mode = 'preview' | 'write';

const MODE_OPTION_LIST: readonly SegmentedOption<Mode>[] = [
  { icon: 'pencil-outline', label: 'Write', value: 'write' },
  { icon: 'eye-outline', label: 'Preview', value: 'preview' },
];

const FORMAT_HINT =
  'Format it with Markdown: # Heading, **bold**, *italic*, - list item, 1. numbered step. ' +
  'Line breaks are kept.';

type InstructionsFieldProps = Readonly<{
  onChange: (instructions: string) => void;
  value: string;
}>;

// The recipe text, written in Markdown: "Write" edits it as typed, "Preview" shows it formatted
// like on the recipe screen.
export function InstructionsField({ onChange, value }: InstructionsFieldProps) {
  const [mode, setMode] = useState<Mode>('write');

  return (
    <View style={styles.field}>
      <SegmentedControl
        label="Recipe"
        onChange={setMode}
        optionList={MODE_OPTION_LIST}
        value={mode}
      />
      {mode === 'write' ? (
        <TextField
          hint={FORMAT_HINT}
          isLabelHidden
          label="Recipe text"
          multiline
          onChangeText={onChange}
          placeholder="Steps, quantities, cooking time…"
          value={value}
        />
      ) : (
        <View style={styles.preview}>
          {value.trim() ? (
            <Markdown text={value} />
          ) : (
            <Text style={styles.muted}>Nothing to preview yet.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  field: {
    gap: theme.gap(2),
  },
  muted: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  // Same frame as the text field, so switching doesn't make the screen jump.
  preview: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    minHeight: theme.size.multilineInput,
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(2),
  },
}));
