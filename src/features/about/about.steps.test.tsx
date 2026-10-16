import { render, screen } from '@testing-library/react-native';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { updatePreferences } from '@/features/settings/preferences';
import { AppLanguage } from '@/test/app-language';
import { AboutScreen } from './about-screen';

// The version app.config.ts gives the app (none under Jest).
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.2.3' } }));

const feature = loadFeature('./about.feature', { loadRelativePath: true });

defineFeature(feature, (test) => {
  beforeEach(() => {
    updatePreferences({ language: 'en' });
  });

  const openTheAboutPage = async () => {
    await render(
      <AppLanguage>
        <AboutScreen />
      </AppLanguage>,
    );
  };

  const readWhatStaysOnThisDevice = () => {
    expect(screen.getByRole('header', { name: 'On this device' })).toBeOnTheScreen();
    expect(screen.getByText(/saved in a database on this device/)).toBeOnTheScreen();
  };

  test('The About page tells where my data goes', ({ and, then, when }) => {
    when('I open the About page', openTheAboutPage);
    then('I read what stays on this device', readWhatStaysOnThisDevice);
    and('I read what goes to my own server, only if I choose to sync with it', () => {
      expect(
        screen.getByRole('header', { name: 'On your own server, if you choose' }),
      ).toBeOnTheScreen();
      expect(screen.getByText(/^Off by default/)).toBeOnTheScreen();
    });
    and('I read that nothing is sent to anyone else', () => {
      expect(screen.getByRole('header', { name: 'Nothing for anyone else' })).toBeOnTheScreen();
      expect(screen.getByText(/the app blocks this/)).toBeOnTheScreen();
    });
    and("I see the app's version", () => {
      expect(screen.getByText('Version 1.2.3')).toBeOnTheScreen();
    });
  });

  test('The About page speaks my language', ({ given, then, when }) => {
    given('the app is in French', () => {
      updatePreferences({ language: 'fr' });
    });
    when('I open the About page', openTheAboutPage);
    then('I read "Sur cet appareil"', () => {
      expect(screen.getByRole('header', { name: 'Sur cet appareil' })).toBeOnTheScreen();
    });
  });
});
