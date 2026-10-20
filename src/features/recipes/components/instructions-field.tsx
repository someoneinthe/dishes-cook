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
        <View>
          <View style={styles.preview}>
            {value.trim() ? (
              <Markdown text={value} />
            ) : (
              <Text style={styles.muted}>{t.recipes.nothingToPreview}</Text>
            )}
          </View>
          {modeSwitch}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  field: {
    gap: theme.gap(2),
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
    minHeight: theme.size.multilineInput,
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(2),
  },
}));
