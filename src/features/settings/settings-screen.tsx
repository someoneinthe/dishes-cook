import type { ScrollViewInstance } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Messages } from '@/i18n/en';
import type { LanguagePreference } from '@/i18n/languages';
import type { UnitSystem } from '@/lib/units';
import { screenScrollProps } from '@/components/screen-scroll-props';
import { SegmentedControl } from '@/components/segmented-control';
import { useFocusRing } from '@/components/use-focus-ring';
import { ServerSyncSection } from '@/features/sync/components/server-sync-section';
import { useMessages } from '@/i18n/i18n-provider';
import { LANGUAGE_LIST, LANGUAGE_NAMES } from '@/i18n/languages';
import { isTv } from '@/lib/device';
import type { ColorSchemePreference, RecentMealDays } from './preferences';
import { RECENT_MEAL_DAYS_LIST, updatePreferences, usePreferences } from './preferences';

export function SettingsScreen() {
  const t = useMessages();
  const { colorScheme, isShowingButtonLabels, language, recentMealDays, units } = usePreferences();
  // Switch colors are props, not styles.
  const { theme } = useUnistyles();
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const { focusProps, focusStyle } = useFocusRing();
  // Opened from the header's sync status: scrolled to Data storage, which tells more.
  const { section } = useLocalSearchParams<{ section?: 'sync' }>();
  // Data storage's place in the scroll view: the App & data group's, plus its own in the group.
  const [appGroupY, setAppGroupY] = useState<number>();
  const [storageY, setStorageY] = useState<number>();
  const syncSectionY =
    appGroupY === undefined || storageY === undefined ? undefined : appGroupY + storageY;
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
      {/* Two families: what the app proposes and shows (cooking), and how it looks and keeps
          the data (app & data). */}
      <View style={styles.group}>
        <Text accessibilityRole="header" style={styles.groupTitle}>
          {t.settings.cookingGroup}
        </Text>
        <SegmentedControl
          label={t.settings.units}
          onChange={(value) => updatePreferences({ units: value })}
          optionList={unitSystemOptionList(t)}
          value={units}
        />
        <SegmentedControl
          label={t.settings.recentMeals}
          onChange={(value) => updatePreferences({ recentMealDays: toRecentMealDays(value) })}
          optionList={recentMealOptionList(t)}
          value={String(recentMealDays)}
        />
      </View>
      <View
        onLayout={(event) => setAppGroupY(event.nativeEvent.layout.y)}
        style={styles.group}
        testID="app-group"
      >
        <Text accessibilityRole="header" style={styles.groupTitle}>
          {t.settings.appGroup}
        </Text>
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
        {/* The whole row is the control: a tap on the label toggles it too, and the remote's focus
            ring goes around it (a Switch takes no focus events, so no ring could follow it). */}
        <Pressable
          accessibilityHint={t.settings.showButtonLabelsHint}
          accessibilityLabel={t.settings.showButtonLabels}
          accessibilityRole="switch"
          accessibilityState={{ checked: isShowingButtonLabels }}
          onPress={() => updatePreferences({ isShowingButtonLabels: !isShowingButtonLabels })}
          {...focusProps}
          style={[styles.switchRow, focusStyle]}
        >
          <Text style={styles.label}>{t.settings.showButtonLabels}</Text>
          {/* Only shows the state: the row is what screen readers and the remote reach. */}
          <Switch
            accessibilityElementsHidden
            focusable={false}
            importantForAccessibility="no-hide-descendants"
            onValueChange={(value) => updatePreferences({ isShowingButtonLabels: value })}
            // Off: thumb and track both stand out from the background (≥ 3:1), the thumb most.
            thumbColor={isShowingButtonLabels ? theme.colors.onAction : theme.colors.textMuted}
            trackColor={{ false: theme.colors.borderStrong, true: theme.colors.actionPrimary }}
            value={isShowingButtonLabels}
          />
        </Pressable>
        <View onLayout={(event) => setStorageY(event.nativeEvent.layout.y)} testID="data-storage">
          <ServerSyncSection isSyncNowFocused={isTv && section === 'sync'} />
        </View>
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

// The meal choice skips the recipes cooked in the last days (the meal history), or doesn't (0).
// The control's values are strings.
function recentMealOptionList(t: Messages): readonly SegmentedOption<string>[] {
  return RECENT_MEAL_DAYS_LIST.map((days) => ({
    label: t.settings.recentMealsDays(days),
    value: String(days),
  }));
}

function toRecentMealDays(value: string): RecentMealDays {
  return RECENT_MEAL_DAYS_LIST.find((days) => String(days) === value) ?? 0;
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
    gap: theme.gap(8),
    maxWidth: theme.size.maxContent,
    padding: theme.gap(4),
    width: '100%',
  },
  // A family of settings, under its title.
  group: {
    gap: theme.gap(5),
  },
  groupTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
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
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.gap(4),
    minHeight: theme.size.touchTarget,
  },
}));
