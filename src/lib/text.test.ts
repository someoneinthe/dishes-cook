import { cleanName, toLikeContains, toNameKey, toSortKey } from './text';

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
  });

  it('builds a LIKE pattern matching the typed text literally', () => {
    expect(toLikeContains('ÉCRASÉ')).toBe('%ecrase%');
    expect(toLikeContains('100%_\\')).toBe(String.raw`%100\%\_\\%`);
  });
});
