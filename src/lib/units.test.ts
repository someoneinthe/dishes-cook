import { UNIT_LIST } from '@/db/schema';
import { formatAmount, parseAmount, toQuantity, toSystem, unitOptionList } from './units';

describe('units', () => {
  describe('toQuantity', () => {
    it('keeps a positive amount and a known unit', () => {
      expect(toQuantity(1.5, 'kg')).toStrictEqual({ amount: 1.5, unit: 'kg' });
      expect(toQuantity(3, null)).toStrictEqual({ amount: 3 });
    });

    it('drops what is not a usable quantity', () => {
      expect(toQuantity(0, 'g')).toBeUndefined();
      expect(toQuantity(-2, 'g')).toBeUndefined();
      expect(toQuantity(NaN, 'g')).toBeUndefined();
      expect(toQuantity('2', 'g')).toBeUndefined();
      expect(toQuantity(1_000_000, 'g')).toBeUndefined();
    });

    it('keeps the amount of an unknown unit, as pieces', () => {
      expect(toQuantity(2, 'cubit')).toStrictEqual({ amount: 2 });
    });
  });

  describe('toSystem', () => {
    it('keeps units of the reader system, spoons and counted units', () => {
      expect(toSystem({ amount: 250, unit: 'g' }, 'metric')).toStrictEqual({
        amount: 250,
        unit: 'g',
      });
      expect(toSystem({ amount: 2, unit: 'tbsp' }, 'us')).toStrictEqual({
        amount: 2,
        unit: 'tbsp',
      });
      expect(toSystem({ amount: 1, unit: 'clove' }, 'us')).toStrictEqual({
        amount: 1,
        unit: 'clove',
      });
      expect(toSystem({ amount: 3 }, 'us')).toStrictEqual({ amount: 3 });
    });

    it.each([
      [{ amount: 8, unit: 'oz' } as const, { amount: 227, unit: 'g' }],
      [{ amount: 3, unit: 'lb' } as const, { amount: 1.36, unit: 'kg' }],
      [{ amount: 1, unit: 'cup' } as const, { amount: 237, unit: 'ml' }],
      [{ amount: 6, unit: 'cup' } as const, { amount: 1.42, unit: 'l' }],
      [{ amount: 2, unit: 'fl_oz' } as const, { amount: 59, unit: 'ml' }],
    ])('converts %o to European units: %o', (quantity, expected) => {
      expect(toSystem(quantity, 'metric')).toStrictEqual(expected);
    });

    it.each([
      [{ amount: 100, unit: 'g' } as const, { amount: 3.5, unit: 'oz' }],
      [{ amount: 1, unit: 'kg' } as const, { amount: 2.25, unit: 'lb' }],
      [{ amount: 500, unit: 'ml' } as const, { amount: 2, unit: 'cup' }],
      [{ amount: 3, unit: 'cl' } as const, { amount: 1, unit: 'fl_oz' }],
      [{ amount: 1, unit: 'l' } as const, { amount: 4.25, unit: 'cup' }],
    ])('converts %o to US units: %o', (quantity, expected) => {
      expect(toSystem(quantity, 'us')).toStrictEqual(expected);
    });

    it('never rounds a converted amount down to zero', () => {
      expect(toSystem({ amount: 0.01, unit: 'oz' }, 'metric')).toStrictEqual({
        amount: 1,
        unit: 'g',
      });
      expect(toSystem({ amount: 1, unit: 'g' }, 'us')).toStrictEqual({ amount: 0.1, unit: 'oz' });
    });
  });

  describe('parseAmount', () => {
    it.each([
      ['2', 2],
      ['1.5', 1.5],
      ['1,5', 1.5],
      [' 0,25 ', 0.25],
      ['.5', 0.5],
      ['1/2', 0.5],
      ['1 1/2', 1.5],
      ['3 / 4', 0.75],
    ])('reads %s as %d', (text, amount) => {
      expect(parseAmount(text)).toBe(amount);
    });

    it.each(['', 'abc', '0', '0.001', '-1', '1/0', '2kg', '1.2.3', '100001'])(
      'refuses %p',
      (text) => {
        expect(parseAmount(text)).toBeUndefined();
      },
    );
  });

  it('formats an amount with the language decimal separator', () => {
    expect(formatAmount(1.5, ',')).toBe('1,5');
    expect(formatAmount(2, ',')).toBe('2');
    expect(formatAmount(1 / 3, '.')).toBe('0.33');
  });

  it('offers the units of the system, and the current one from the other system', () => {
    expect(unitOptionList('metric')).toStrictEqual([
      'g',
      'kg',
      'ml',
      'cl',
      'l',
      'tsp',
      'tbsp',
      'pinch',
      'clove',
      'bunch',
      'can',
    ]);
    expect(unitOptionList('us', 'g')[0]).toBe('g');
    expect(unitOptionList('us', 'cup')).not.toContain('g');
    // Every unit is offered by one system or both.
    expect(new Set([...unitOptionList('metric'), ...unitOptionList('us')])).toStrictEqual(
      new Set(UNIT_LIST),
    );
  });
});
