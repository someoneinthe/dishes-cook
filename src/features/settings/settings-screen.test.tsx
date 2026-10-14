import type { Locale } from 'expo-localization';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useLocales } from 'expo-localization';
import { Appearance } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { AppLanguage } from '@/test/app-language';
import { getPreferences, updatePreferences } from './preferences';
import { SettingsScreen } from './settings-screen';

describe('settingsScreen', () => {
  beforeEach(() => {
    updatePreferences({ colorScheme: 'system', isShowingButtonLabels: false, language: 'system' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forces the dark theme', async () => {
    const colorSchemeSpy = jest.spyOn(Appearance, 'setColorScheme');
    const themeSpy = jest.spyOn(UnistylesRuntime, 'setTheme');
    const adaptiveThemesSpy = jest.spyOn(UnistylesRuntime, 'setAdaptiveThemes');
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));

    expect(colorSchemeSpy).toHaveBeenLastCalledWith('dark');
    expect(adaptiveThemesSpy).toHaveBeenLastCalledWith(false);
    expect(themeSpy).toHaveBeenLastCalledWith('dark');
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(getPreferences().colorScheme).toBe('dark');
  });

  it('follows the phone again', async () => {
    updatePreferences({ colorScheme: 'dark' });
    const colorSchemeSpy = jest.spyOn(Appearance, 'setColorScheme');
    const adaptiveThemesSpy = jest.spyOn(UnistylesRuntime, 'setAdaptiveThemes');
    await render(<SettingsScreen />);

    await fireEvent.press(
      within(screen.getByLabelText('Appearance')).getByRole('radio', { name: 'System' }),
    );

    expect(colorSchemeSpy).toHaveBeenLastCalledWith('unspecified');
    expect(adaptiveThemesSpy).toHaveBeenLastCalledWith(true);
  });

  it('shows the text of icon-only buttons when asked', async () => {
    await render(
      <>
        <SettingsScreen />
        <Button icon="pencil" isIconOnly label="Edit" onPress={jest.fn()} variant="secondary" />
      </>,
    );

    expect(screen.queryByText('Edit')).not.toBeOnTheScreen();

    await fireEvent(
      screen.getByRole('switch', { name: 'Show button labels' }),
      'valueChange',
      true,
    );

    expect(screen.getByText('Edit')).toBeOnTheScreen();
    expect(getPreferences().isShowingButtonLabels).toBe(true);
  });

  it('switches the app to French, then back to English', async () => {
    await render(
      <AppLanguage>
        <SettingsScreen />
      </AppLanguage>,
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'Français' }));

    expect(screen.getByText('Langue')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Français' })).toBeChecked();
    expect(getPreferences().language).toBe('fr');

    await fireEvent.press(screen.getByRole('radio', { name: 'English' }));

    expect(screen.getByText('Language')).toBeOnTheScreen();
  });

  it('follows the phone’s language by default', async () => {
    jest
      .mocked(useLocales)
      .mockReturnValue([{ languageCode: 'fr', languageTag: 'fr-FR' } as Locale]);
    await render(
      <AppLanguage>
        <SettingsScreen />
      </AppLanguage>,
    );

    expect(screen.getByText('Apparence')).toBeOnTheScreen();
    expect(
      within(screen.getByLabelText('Langue')).getByRole('radio', { name: 'Système' }),
    ).toBeChecked();
  });
});
