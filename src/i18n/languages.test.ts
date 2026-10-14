import { en } from './en';
import { fr } from './fr';
import { resolveLanguage } from './languages';

describe('i18n', () => {
  describe('resolveLanguage', () => {
    it('uses the language chosen in the settings', () => {
      expect(resolveLanguage('fr', 'en')).toBe('fr');
      expect(resolveLanguage('en', 'fr')).toBe('en');
    });

    it('follows the phone when it is a language of the app', () => {
      expect(resolveLanguage('system', 'fr')).toBe('fr');
    });

    it('falls back to English for other phone languages', () => {
      expect(resolveLanguage('system', 'de')).toBe('en');
      expect(resolveLanguage('system', null)).toBe('en');
    });
  });

  describe('messages', () => {
    it('count in each language’s grammar', () => {
      expect(en.recipes.ingredientCount(0)).toBe('0 ingredients');
      expect(en.recipes.ingredientCount(1)).toBe('1 ingredient');
      expect(fr.recipes.ingredientCount(0)).toBe('0 ingrédient');
      expect(fr.recipes.ingredientCount(2)).toBe('2 ingrédients');
    });

    it('follow French typography', () => {
      expect(fr.common.deleteTitle('Soupe')).toBe('Supprimer «\u{A0}Soupe\u{A0}»\u{202F}?');
    });
  });
});
