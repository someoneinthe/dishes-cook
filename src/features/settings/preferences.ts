import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import type { LanguagePreference } from '@/i18n/languages';
import type { UnitSystem } from '@/lib/units';
import { LANGUAGE_PREFERENCE_LIST } from '@/i18n/languages';
import { isUnitSystem } from '@/lib/units';

// User preferences, kept in expo-sqlite's key-value store (synchronous reads: applied before the
// first screen renders).

const COLOR_SCHEME_LIST = ['system', 'light', 'dark'] as const;
export type ColorSchemePreference = (typeof COLOR_SCHEME_LIST)[number];

// How many days the meal choice skips the recipes cooked recently; 0 = it doesn't.
export const RECENT_MEAL_DAYS_LIST = [0, 7, 14, 30] as const;
type Preferences = Readonly<{
  colorScheme: ColorSchemePreference;
  // Show the text of icon-only buttons too.
  isShowingButtonLabels: boolean;
  // The phone's language ('system') or one chosen for the app.
  language: LanguagePreference;
  // The meal choice skips the recipes cooked in the last days (the meal history).
  recentMealDays: RecentMealDays;
  // Units of ingredient quantities: European (metric, the default) or US.
  units: UnitSystem;
}>;

export type RecentMealDays = (typeof RECENT_MEAL_DAYS_LIST)[number];

const STORAGE_KEY = 'preferences';
const DEFAULT_PREFERENCES: Preferences = {
  colorScheme: 'system',
  isShowingButtonLabels: false,
  language: 'system',
  recentMealDays: 14,
  units: 'metric',
};

// Read once from storage, then kept in memory.
const state: { current?: Preferences } = {};
const listenerSet = new Set<() => void>();

// Following the phone: listening to Appearance while the preference is 'system'.
const appearance: { subscription?: Readonly<{ remove: () => void }> } = {};

// Forces the app's color scheme, or follows the phone's: the Unistyles theme (the screens), and
// Appearance for native UI (status bar, dialogs, keyboard).
// For 'system', the theme follows Appearance, not Unistyles' adaptive themes: on Android these read
// the configuration before it's updated when the phone switches light/dark while the app runs, so
// the app stayed one switch behind. Appearance is told by the activity itself.
export function applyColorScheme(colorScheme: ColorSchemePreference): void {
  Appearance.setColorScheme(colorScheme === 'system' ? 'unspecified' : colorScheme);
  appearance.subscription?.remove();
  appearance.subscription = undefined;
  UnistylesRuntime.setAdaptiveThemes(false);
  if (colorScheme === 'system') {
    followPhone(Appearance.getColorScheme());
    appearance.subscription = Appearance.addChangeListener((preferences) => {
      followPhone(preferences.colorScheme);
    });
  } else {
    UnistylesRuntime.setTheme(colorScheme);
  }
}

export function getPreferences(): Preferences {
  state.current ??= parse(Storage.getItemSync(STORAGE_KEY));
  return state.current;
}

export function updatePreferences(changes: Partial<Preferences>): void {
  const next = { ...getPreferences(), ...changes };
  // Stored first: if the write throws, the app keeps showing what is saved.
  Storage.setItemSync(STORAGE_KEY, JSON.stringify(next));
  state.current = next;
  if (changes.colorScheme) {
    applyColorScheme(next.colorScheme);
  }
  for (const listener of listenerSet) {
    listener();
  }
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences);
}

// The phone's light/dark setting; light when it has none.
function followPhone(colorScheme: ReturnType<typeof Appearance.getColorScheme>): void {
  UnistylesRuntime.setTheme(colorScheme === 'dark' ? 'dark' : 'light');
}

function parse(stored: null | string): Preferences {
  if (!stored) {
    return DEFAULT_PREFERENCES;
  }
  try {
    const parsed = JSON.parse(stored) as Partial<Preferences>;
    return {
      colorScheme: COLOR_SCHEME_LIST.includes(parsed.colorScheme as ColorSchemePreference)
        ? (parsed.colorScheme as ColorSchemePreference)
        : DEFAULT_PREFERENCES.colorScheme,
      isShowingButtonLabels: parsed.isShowingButtonLabels === true,
      language: LANGUAGE_PREFERENCE_LIST.includes(parsed.language as LanguagePreference)
        ? (parsed.language as LanguagePreference)
        : DEFAULT_PREFERENCES.language,
      recentMealDays: RECENT_MEAL_DAYS_LIST.includes(parsed.recentMealDays as RecentMealDays)
        ? (parsed.recentMealDays as RecentMealDays)
        : DEFAULT_PREFERENCES.recentMealDays,
      units: isUnitSystem(parsed.units) ? parsed.units : DEFAULT_PREFERENCES.units,
    };
  } catch {
    // Unreadable (e.g. written by a future version): start from the defaults.
    return DEFAULT_PREFERENCES;
  }
}

function subscribe(listener: () => void) {
  listenerSet.add(listener);
  return () => {
    listenerSet.delete(listener);
  };
}
