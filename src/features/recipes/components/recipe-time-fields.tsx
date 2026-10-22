import type { Ref } from 'react';
import type { TextInputInstance } from 'react-native';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { RecipeKind } from '@/db/schema';
import type { Messages } from '@/i18n/en';
import { TextField } from '@/components/text-field';
import { useMessages } from '@/i18n/i18n-provider';

// What the user typed in the time fields: minutes, and a drink's maturation in months.
export type TimeDrafts = Readonly<{ cook: string; maturation: string; prep: string }>;

type RecipeTimeFieldsProps = Readonly<{
  drafts: TimeDrafts;
  // The fields, to bring a wrong one into view on Save.
  inputRefs?: Readonly<Record<keyof TimeDrafts, Ref<TextInputInstance>>>;
  // The fields that aren't a usable time.
  invalidList: readonly (keyof TimeDrafts)[];
  // A dish's: preparation and cooking; a drink's: preparation and maturation.
  kind: RecipeKind;
  onChange: (drafts: TimeDrafts) => void;
}>;

// The error of a time field that isn't a usable time.
const INVALID_MESSAGE_OF: Readonly<Record<keyof TimeDrafts, (t: Messages) => string>> = {
  cook: (t) => t.recipes.invalidMinutes,
  maturation: (t) => t.recipes.invalidMaturation,
  prep: (t) => t.recipes.invalidMinutes,
};

// Preparation and cooking times in minutes, or a drink's preparation and maturation (months), side
// by side (they wrap with a large font).
export function RecipeTimeFields({
  drafts,
  inputRefs,
  invalidList,
  kind,
  onChange,
}: RecipeTimeFieldsProps) {
  const t = useMessages();
  const errorOf = (field: keyof TimeDrafts): string | undefined =>
    invalidList.includes(field) ? INVALID_MESSAGE_OF[field](t) : undefined;

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
      {kind === 'dish' ? (
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
      ) : (
        <View style={styles.field}>
          <TextField
            error={errorOf('maturation')}
            // Months can be a fraction: 0.5.
            keyboardType="decimal-pad"
            label={t.recipes.maturationTime}
            onChangeText={(maturation) => onChange({ ...drafts, maturation })}
            placeholder={t.recipes.monthsPlaceholder}
            ref={inputRefs?.maturation}
            value={drafts.maturation}
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
