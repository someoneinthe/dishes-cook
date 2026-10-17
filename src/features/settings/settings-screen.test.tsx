import type { Locale } from 'expo-localization';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useLocales } from 'expo-localization';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Appearance, ScrollView } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { AppLanguage } from '@/test/app-language';
import { getPreferences, updatePreferences } from './preferences';
import { SettingsScreen } from './settings-screen';

jest.mock('expo-router', () => ({
  router: { setParams: jest.fn() },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));

// Tested on its own (server-sync-section.test.tsx); it needs a database these tests don't.
jest.mock('../sync/components/server-sync-section', () => ({ ServerSyncSection: () => null }));

describe('settingsScreen', () => {
  beforeEach(() => {
    updatePreferences({
      colorScheme: 'system',
      isShowingButtonLabels: false,
      language: 'system',
      units: 'metric',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('scrolls to Data storage when opened from the header’s sync status', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ section: 'sync' });
    // Focused as soon as shown.
    jest.mocked(useFocusEffect).mockImplementation((effect) => {
      useEffect(effect, [effect]);
    });
    const scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo');
    await render(<SettingsScreen />);

    await fireEvent(screen.getByTestId('data-storage'), 'layout', {
      nativeEvent: { layout: { height: 200, width: 400, x: 0, y: 600 } },
    });

    expect(scrollToSpy).toHaveBeenCalledWith({ animated: false, y: 600 });
    // Scrolled once: opening Settings again starts at the top.
    expect(router.setParams).toHaveBeenCalledWith({ section: undefined });
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

  it('follows the phone again, and its later light/dark switches', async () => {
    updatePreferences({ colorScheme: 'dark' });
    const colorSchemeSpy = jest.spyOn(Appearance, 'setColorScheme');
    const themeSpy = jest.spyOn(UnistylesRuntime, 'setTheme');
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');
    const removeSpy = jest.fn();
    const listenerSpy = jest
      .spyOn(Appearance, 'addChangeListener')
      .mockReturnValue({ remove: removeSpy });
    await render(<SettingsScreen />);

    await fireEvent.press(
      within(screen.getByLabelText('Appearance')).getByRole('radio', { name: 'System' }),
    );

    expect(colorSchemeSpy).toHaveBeenLastCalledWith('unspecified');
    expect(themeSpy).toHaveBeenLastCalledWith('dark');

    // The phone switches to light while the app runs.
    listenerSpy.mock.lastCall?.[0]({ colorScheme: 'light' });

    expect(themeSpy).toHaveBeenLastCalledWith('light');

    // A forced theme stops following the phone.
    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));

    expect(removeSpy).toHaveBeenCalledTimes(1);
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

  it('uses European units by default, and US units when chosen', async () => {
    await render(<SettingsScreen />);

    expect(screen.getByRole('radio', { name: 'European (g, l)' })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: 'US (oz, cups)' }));

    expect(getPreferences().units).toBe('us');
  });

  it('switches the app to French, then back to English', async () => {
    await render(
      <AppLanguage>
        <SettingsScreen />
      </AppLanguage>,
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'Français' }));

    expect(screen.getByLabelText('Langue')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Français' })).toBeChecked();
    expect(getPreferences().language).toBe('fr');

    await fireEvent.press(screen.getByRole('radio', { name: 'English' }));

    expect(screen.getByLabelText('Language')).toBeOnTheScreen();
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

    expect(screen.getByLabelText('Apparence')).toBeOnTheScreen();
    expect(
      within(screen.getByLabelText('Langue')).getByRole('radio', { name: 'Système' }),
    ).toBeChecked();
  });
});
