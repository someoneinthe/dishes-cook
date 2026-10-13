import { cleanName, isMatchingSearch, sortByText, toNameKey } from './text';

describe('text', () => {
  it('cleans the whitespace of a name', () => {
    expect(cleanName('  Olive   oil \n')).toBe('Olive oil');
  });

  it('builds a case-insensitive but accent-sensitive key', () => {
    expect(toNameKey(' ŒUF ')).toBe(toNameKey('œuf'));
    expect(toNameKey('pâte')).not.toBe(toNameKey('pâté'));
  });

  it('searches without case or accents', () => {
    expect(isMatchingSearch('Pommes de terre écrasées', 'ECRASE')).toBe(true);
    expect(isMatchingSearch('Carotte', 'navet')).toBe(false);
  });

  it('sorts names alphabetically, accented first letters included', () => {
    expect(sortByText(['zucchini', 'Échalote', 'ail', 'Oignon'], (name) => name)).toStrictEqual([
      'ail',
      'Échalote',
      'Oignon',
      'zucchini',
    ]);
  });
});
