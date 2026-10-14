import type { Messages } from './en';
import { en } from './en';
import { fr } from './fr';

// The languages the app is translated into (also listed in app.config.ts › expo-localization).
export const LANGUAGE_LIST = ['en', 'fr'] as const;
export type Language = (typeof LANGUAGE_LIST)[number];

// Settings › Language: the phone's language, or one chosen for the app.
export type LanguagePreference = 'system' | Language;
export const LANGUAGE_PREFERENCE_LIST: readonly LanguagePreference[] = ['system', ...LANGUAGE_LIST];

// Each language is named in itself, whatever the app's language.
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  en: 'English',
  fr: 'Français',
};

export const MESSAGES: Readonly<Record<Language, Messages>> = { en, fr };

// The phone's language when the app has it, else English.
export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguageCode: null | string | undefined,
): Language {
  return preference === 'system'
    ? (LANGUAGE_LIST.find((language) => language === deviceLanguageCode) ?? 'en')
    : preference;
}
