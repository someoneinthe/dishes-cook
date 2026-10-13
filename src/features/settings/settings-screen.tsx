import { ScrollView, Switch, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import { SegmentedControl } from '@/components/segmented-control';
import type { ColorSchemePreference } from './preferences';
import { updatePreferences, usePreferences } from './preferences';

const COLOR_SCHEME_OPTION_LIST: readonly SegmentedOption<ColorSchemePreference>[] = [
  { icon: 'cellphone', label: 'System', value: 'system' },
  { icon: 'white-balance-sunny', label: 'Light', value: 'light' },
  { icon: 'weather-night', label: 'Dark', value: 'dark' },
];

export function SettingsScreen() {
  const { colorScheme, isShowingButtonLabels } = usePreferences();
  // Switch colors are props, not styles.
  const { theme } = useUnistyles();

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <SegmentedControl
        label="Appearance"
        onChange={(value) => updatePreferences({ colorScheme: value })}
        optionList={COLOR_SCHEME_OPTION_LIST}
        value={colorScheme}
      />
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.label}>Show button labels</Text>
          <Text style={styles.description}>
            Adds the text next to icon buttons (add, edit, delete, save…).
          </Text>
        </View>
        <Switch
          accessibilityHint="Adds the text next to icon buttons"
          accessibilityLabel="Show button labels"
          onValueChange={(value) => updatePreferences({ isShowingButtonLabels: value })}
          thumbColor={theme.colors.surface}
          trackColor={{ false: theme.colors.border, true: theme.colors.actionPrimary }}
          value={isShowingButtonLabels}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.gap(6),
    padding: theme.gap(4),
  },
  description: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.gap(4),
  },
  switchText: {
    flex: 1,
    gap: theme.gap(1),
  },
}));
