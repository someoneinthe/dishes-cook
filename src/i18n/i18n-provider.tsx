import type { ReactNode } from 'react';
import { useLocales } from 'expo-localization';
import { createContext, use } from 'react';
import { usePreferences } from '@/features/settings/preferences';
import type { Messages } from './en';
import { en } from './en';
import { MESSAGES, resolveLanguage } from './languages';

// English outside the provider (component tests).
const MessagesContext = createContext<Messages>(en);

// Resolves the app's language once for every screen: Settings › Language, or the phone's language
// (`useLocales` re-renders when it changes).
export function I18nProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { language } = usePreferences();
  const [deviceLocale] = useLocales();
  const messages = MESSAGES[resolveLanguage(language, deviceLocale?.languageCode)];

  return <MessagesContext value={messages}>{children}</MessagesContext>;
}

// The UI text in the app's language.
export function useMessages(): Messages {
  return use(MessagesContext);
}
