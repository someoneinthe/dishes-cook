import type { ReactNode } from 'react';
import { usePreferences } from '@/features/settings/preferences';
import { I18nProvider } from '@/i18n/i18n-provider';

// The app's languages as the root layout sets them up: Settings › Language, else the phone's.
export function AppLanguage({ children }: Readonly<{ children: ReactNode }>) {
  const { language } = usePreferences();
  return <I18nProvider language={language}>{children}</I18nProvider>;
}
