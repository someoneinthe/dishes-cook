import type { Ref } from 'react';
import type { TextInput } from 'react-native';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { TextField } from '@/components/text-field';
import { useMessages } from '@/i18n/i18n-provider';

// What the user typed in the two time fields, and which one isn't a number of minutes.
export type TimeDrafts = Readonly<{ cook: string; prep: string }>;

type RecipeTimeFieldsProps = Readonly<{
  drafts: TimeDrafts;
  // The fields, to bring a wrong one into view on Save.
  inputRefs?: Readonly<Record<keyof TimeDrafts, Ref<TextInput>>>;
  invalidList: readonly (keyof TimeDrafts)[];
  // A drink's: the preparation time only.
  isCookHidden?: boolean;
  onChange: (drafts: TimeDrafts) => void;
}>;

// Preparation and cooking times, in minutes, side by side (they wrap with a large font).
export function RecipeTimeFields({
  drafts,
  inputRefs,
  invalidList,
  isCookHidden = false,
  onChange,
}: RecipeTimeFieldsProps) {
  const t = useMessages();
  const errorOf = (field: keyof TimeDrafts) =>
    invalidList.includes(field) ? t.recipes.invalidMinutes : undefined;

  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <TextField
          error={errorOf('prep')}
          keyboardType="number-pad"
          label={t.recipes.prepTime}
          onChangeText={(prep) => onChange({ ...drafts, prep })}
          placeholder={t.recipes.minutesPlaceholder}
          ref={inputRefs?.prep}
          value={drafts.prep}
        />
      </View>
      {!isCookHidden && (
        <View style={styles.field}>
          <TextField
            error={errorOf('cook')}
            keyboardType="number-pad"
            label={t.recipes.cookTime}
            onChangeText={(cook) => onChange({ ...drafts, cook })}
            placeholder={t.recipes.minutesPlaceholder}
            ref={inputRefs?.cook}
            value={drafts.cook}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  field: {
    flexBasis: theme.size.minText,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(4),
  },
}));
