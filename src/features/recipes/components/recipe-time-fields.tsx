import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { TextField } from '@/components/text-field';
import { useMessages } from '@/i18n/i18n-provider';

// What the user typed in the two time fields, and which one isn't a number of minutes.
export type TimeDrafts = Readonly<{ cook: string; prep: string }>;

type RecipeTimeFieldsProps = Readonly<{
  drafts: TimeDrafts;
  invalidList: readonly (keyof TimeDrafts)[];
  onChange: (drafts: TimeDrafts) => void;
}>;

// Preparation and cooking times, in minutes, side by side (they wrap with a large font).
export function RecipeTimeFields({ drafts, invalidList, onChange }: RecipeTimeFieldsProps) {
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
          value={drafts.prep}
        />
      </View>
      <View style={styles.field}>
        <TextField
          error={errorOf('cook')}
          keyboardType="number-pad"
          label={t.recipes.cookTime}
          onChangeText={(cook) => onChange({ ...drafts, cook })}
          placeholder={t.recipes.minutesPlaceholder}
          value={drafts.cook}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  field: {
    flexBasis: 160,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(4),
  },
}));
