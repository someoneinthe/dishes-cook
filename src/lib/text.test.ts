import { cleanName, toLikeContains, toNameKey, toSortKey, toWordForms } from './text';

describe('text', () => {
  it('cleans the whitespace of a name', () => {
    expect(cleanName('  Olive   oil \n')).toBe('Olive oil');
  });

  it('builds a case-insensitive but accent-sensitive key', () => {
    expect(toNameKey(' ŒUF ')).toBe(toNameKey('œuf'));
    expect(toNameKey('pâte')).not.toBe(toNameKey('pâté'));
  });

  it('builds a sort key without case or accents', () => {
    expect(toSortKey('  Pommes de terre   Écrasées')).toBe('pommes de terre ecrasees');
    expect(toSortKey('Œuf')).toBe('oeuf');
    expect(toSortKey('Cæcum')).toBe('caecum');
  });

  it('lists the singular and plural forms of a name', () => {
    expect(toWordForms('Carrot')).toStrictEqual(['carrot', 'carrots']);
    expect(toWordForms('carottes')).toStrictEqual(['carottes', 'carotte', 'carott']);
    expect(toWordForms('Poireaux')).toStrictEqual(['poireaux', 'poireau']);
    expect(toWordForms('gâteau')).toStrictEqual(['gateau', 'gateaux']);
  });

  it('lists the forms of English plurals and of each word of a longer name', () => {
    expect(toWordForms('tomato')).toStrictEqual(['tomato', 'tomatoes', 'tomatos']);
    expect(toWordForms('cherries')).toStrictEqual(['cherries', 'cherry']);
    expect(toWordForms('pomme de terre')).toStrictEqual([
      'pomme de terre',
      'pomme de terres',
      'pommes de terre',
      'pommes de terres',
    ]);
  });

  it('builds a LIKE pattern matching the typed text literally', () => {
    expect(toLikeContains('ÉCRASÉ')).toBe('%ecrase%');
    expect(toLikeContains('100%_\\')).toBe(String.raw`%100\%\_\\%`);
  });
});
