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
  value: string;
}>;

type Mode = 'preview' | 'write';

// The recipe text, written in Markdown: "Write" edits it as typed, "Preview" shows it formatted
// like on the recipe screen.
export function InstructionsField({ onChange, value }: InstructionsFieldProps) {
  const t = useMessages();
  const [mode, setMode] = useState<Mode>('write');
  const modeOptionList: readonly SegmentedOption<Mode>[] = [
    { icon: 'pencil-outline', label: t.recipes.write, value: 'write' },
    { icon: 'eye-outline', label: t.recipes.preview, value: 'preview' },
  ];

  return (
    <View style={styles.field}>
      <SegmentedControl
        label={t.recipes.recipe}
        onChange={setMode}
        optionList={modeOptionList}
        value={mode}
      />
      {mode === 'write' ? (
        <TextField
          hint={t.recipes.formatHint}
          isLabelHidden
          label={t.recipes.recipeText}
          multiline
          onChangeText={onChange}
          placeholder={t.recipes.instructionsPlaceholder}
          value={value}
        />
      ) : (
        <View style={styles.preview}>
          {value.trim() ? (
            <Markdown text={value} />
          ) : (
            <Text style={styles.muted}>{t.recipes.nothingToPreview}</Text>
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
