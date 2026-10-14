import type { ReactNode } from 'react';
import { useLocales } from 'expo-localization';
import { createContext, use } from 'react';
import type { Messages } from './en';
import type { LanguagePreference } from './languages';
import { en } from './en';
import { MESSAGES, resolveLanguage } from './languages';

// English outside the provider (component tests).
const MessagesContext = createContext<Messages>(en);

type I18nProviderProps = Readonly<{
  children: ReactNode;
  // Settings › Language.
  language: LanguagePreference;
}>;

// Resolves the app's language once for every screen: the one chosen in the settings, or the phone's
// (`useLocales` re-renders when it changes).
export function I18nProvider({ children, language }: I18nProviderProps) {
  const [deviceLocale] = useLocales();
  const messages = MESSAGES[resolveLanguage(language, deviceLocale?.languageCode)];

  return <MessagesContext value={messages}>{children}</MessagesContext>;
}

// The UI text in the app's language.
export function useMessages(): Messages {
  return use(MessagesContext);
}
