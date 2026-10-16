import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Messages } from '@/i18n/en';
import type { LanguagePreference } from '@/i18n/languages';
import type { UnitSystem } from '@/lib/units';
import { screenScrollProps } from '@/components/screen-scroll-props';
import { SegmentedControl } from '@/components/segmented-control';
import { ServerSyncSection } from '@/features/sync/components/server-sync-section';
import { useMessages } from '@/i18n/i18n-provider';
import { LANGUAGE_LIST, LANGUAGE_NAMES } from '@/i18n/languages';
import { isTv } from '@/lib/device';
import type { ColorSchemePreference } from './preferences';
import { updatePreferences, usePreferences } from './preferences';

export function SettingsScreen() {
  const t = useMessages();
  const { colorScheme, isShowingButtonLabels, language, units } = usePreferences();
  // Switch colors are props, not styles.
  const { theme } = useUnistyles();
  const scrollViewRef = useRef<ScrollView>(null);
  // Opened from the header's sync status: scrolled to Data storage, which tells more.
  const { section } = useLocalSearchParams<{ section?: 'sync' }>();
  const [syncSectionY, setSyncSectionY] = useState<number>();
  // Kept stable between renders by React Compiler: runs again only when its values change.
  useFocusEffect(() => {
    if (section !== 'sync' || syncSectionY === undefined) {
      return;
    }
    scrollViewRef.current?.scrollTo({ animated: false, y: syncSectionY });
    // Done: opening Settings again (from the menu) starts at the top as usual.
    router.setParams({ section: undefined });
  });

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      ref={scrollViewRef}
      style={styles.screen}
      {...screenScrollProps}
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
      <SegmentedControl
        label={t.settings.units}
        onChange={(value) => updatePreferences({ units: value })}
        optionList={unitSystemOptionList(t)}
        value={units}
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
      <View onLayout={(event) => setSyncSectionY(event.nativeEvent.layout.y)} testID="data-storage">
        <ServerSyncSection isSyncNowFocused={isTv && section === 'sync'} />
      </View>
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

// Ingredient quantities: amounts written in the other system are converted.
function unitSystemOptionList(t: Messages): readonly SegmentedOption<UnitSystem>[] {
  return [
    { icon: 'weight-kilogram', label: t.settings.unitsMetric, value: 'metric' },
    { icon: 'weight-pound', label: t.settings.unitsUs, value: 'us' },
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
