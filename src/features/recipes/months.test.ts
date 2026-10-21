import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { formatMonths, formatTypedMonths, MAX_MONTHS, parseMonths, toMonths } from './months';

describe('months', () => {
  it('reads a typed maturation time: months with a dot or a comma, or nothing', () => {
    expect(['2', ' 0.5 ', '1,25', ',5'].map((typed) => parseMonths(typed))).toStrictEqual([
      2, 0.5, 1.25, 0.5,
    ]);
    expect(parseMonths('')).toBeNull();
  });

  it('refuses a typed time that isn’t a usable number of months', () => {
    expect(parseMonths('two')).toBeUndefined();
    expect(parseMonths('0')).toBeUndefined();
    expect(parseMonths('1.125')).toBeUndefined();
    expect(parseMonths('1/2')).toBeUndefined();
    expect(parseMonths(String(MAX_MONTHS + 1))).toBeUndefined();
  });

  it('keeps usable stored or pulled times, to 2 decimals', () => {
    expect([0.5, 1.333, MAX_MONTHS].map((months) => toMonths(months))).toStrictEqual([
      0.5,
      1.33,
      MAX_MONTHS,
    ]);
  });

  it('leaves out stored or pulled times that aren’t usable', () => {
    const unusableList: unknown[] = [0, 0.001, MAX_MONTHS + 1, '2', null, NaN];

    // None of them is kept.
    expect(unusableList.filter((value) => toMonths(value) !== undefined)).toStrictEqual([]);
  });

  it('writes a maturation time in the reader’s language', () => {
    expect([1, 0.5, 2].map((months) => formatMonths(en, months))).toStrictEqual([
      '1 month',
      '0.5 months',
      '2 months',
    ]);
    expect(formatMonths(fr, 0.5)).toBe('0,5\u{A0}mois');
  });

  it('writes a maturation time back into the form as typed', () => {
    expect(formatTypedMonths(fr, 1.5)).toBe('1,5');
    expect(formatTypedMonths(en, undefined)).toBe('');
  });
});
