import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

// User preferences, kept in expo-sqlite's key-value store (synchronous reads: applied before the
// first screen renders).

export const COLOR_SCHEME_LIST = ['system', 'light', 'dark'] as const;
export type ColorSchemePreference = (typeof COLOR_SCHEME_LIST)[number];

export type Preferences = Readonly<{
  colorScheme: ColorSchemePreference;
  // Show the text of icon-only buttons too.
  isShowingButtonLabels: boolean;
}>;

const STORAGE_KEY = 'preferences';
const DEFAULT_PREFERENCES: Preferences = { colorScheme: 'system', isShowingButtonLabels: false };

// Read once from storage, then kept in memory.
const state: { current?: Preferences } = {};
const listenerSet = new Set<() => void>();

// Forces the app's color scheme, or follows the phone's: the Unistyles theme (the screens), and
// Appearance for native UI (status bar, dialogs, keyboard).
export function applyColorScheme(colorScheme: ColorSchemePreference): void {
  Appearance.setColorScheme(colorScheme === 'system' ? 'unspecified' : colorScheme);
  if (colorScheme === 'system') {
    UnistylesRuntime.setAdaptiveThemes(true);
  } else {
    UnistylesRuntime.setAdaptiveThemes(false);
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
