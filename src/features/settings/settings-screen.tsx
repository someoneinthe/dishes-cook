import { ScrollView, Switch, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Messages } from '@/i18n/en';
import type { LanguagePreference } from '@/i18n/languages';
import { SegmentedControl } from '@/components/segmented-control';
import { ServerSyncSection } from '@/features/sync/components/server-sync-section';
import { useMessages } from '@/i18n/i18n-provider';
import { LANGUAGE_LIST, LANGUAGE_NAMES } from '@/i18n/languages';
import { isTv } from '@/lib/device';
import type { ColorSchemePreference } from './preferences';
import { updatePreferences, usePreferences } from './preferences';

export function SettingsScreen() {
  const t = useMessages();
  const { colorScheme, isShowingButtonLabels, language } = usePreferences();
  // Switch colors are props, not styles.
  const { theme } = useUnistyles();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <SegmentedControl
        label={t.settings.appearance}
        onChange={(value) => updatePreferences({ colorScheme: value })}
        optionList={colorSchemeOptionList(t)}
        value={colorScheme}
      />
      <SegmentedControl
        label={t.settings.language}
        onChange={(value) => updatePreferences({ language: value })}
        optionList={languageOptionList(t)}
        value={language}
      />
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t.settings.showButtonLabels}</Text>
        <Switch
          accessibilityHint={t.settings.showButtonLabelsHint}
          accessibilityLabel={t.settings.showButtonLabels}
          onValueChange={(value) => updatePreferences({ isShowingButtonLabels: value })}
          thumbColor={theme.colors.surface}
          trackColor={{ false: theme.colors.border, true: theme.colors.actionPrimary }}
          value={isShowingButtonLabels}
        />
      </View>
      <ServerSyncSection />
    </ScrollView>
  );
}

// "System": the device's own setting, a phone or a TV.
const SYSTEM_ICON = isTv ? 'television' : 'cellphone';

function colorSchemeOptionList(t: Messages): readonly SegmentedOption<ColorSchemePreference>[] {
  return [
    { icon: SYSTEM_ICON, label: t.settings.system, value: 'system' },
    { icon: 'white-balance-sunny', label: t.settings.light, value: 'light' },
    { icon: 'weather-night', label: t.settings.dark, value: 'dark' },
  ];
}

// "System" follows the phone's language; the others are named in their own language.
function languageOptionList(t: Messages): readonly SegmentedOption<LanguagePreference>[] {
  return [
    { icon: SYSTEM_ICON, label: t.settings.system, value: 'system' },
    ...LANGUAGE_LIST.map((language) => ({ label: LANGUAGE_NAMES[language], value: language })),
  ];
}

const styles = StyleSheet.create((theme) => ({
  content: {
    // Centered on wide screens (TV).
    alignSelf: 'center',
    gap: theme.gap(6),
    maxWidth: theme.size.maxContent,
    padding: theme.gap(4),
    width: '100%',
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
    flex: 1,
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
}));
