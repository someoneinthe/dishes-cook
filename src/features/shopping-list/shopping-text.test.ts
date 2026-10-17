import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { formatShoppingItem, toShoppingItems, toShoppingText } from './shopping-text';

describe('shopping text', () => {
  const lineList = [
    { amount: 5, ingredientId: 1, name: 'Leek' },
    { amount: 200, ingredientId: 1, name: 'Leek', unit: 'g' as const },
    { amount: 1500, ingredientId: 2, name: 'Potato', unit: 'g' as const },
    { ingredientId: 3, name: 'Salt' },
  ];

  it('puts the lines of one ingredient together', () => {
    expect(toShoppingItems(lineList)).toStrictEqual([
      { ingredientId: 1, name: 'Leek', quantityList: [{ amount: 5 }, { amount: 200, unit: 'g' }] },
      { ingredientId: 2, name: 'Potato', quantityList: [{ amount: 1500, unit: 'g' }] },
      { ingredientId: 3, name: 'Salt', quantityList: [] },
    ]);
  });

  it('shows the quantities in the reader’s units', () => {
    const [leek, potato, salt] = toShoppingItems(lineList);

    expect(formatShoppingItem(en, leek!, 'metric')).toBe('Leek: 5 + 200 g');
    expect(formatShoppingItem(en, potato!, 'metric')).toBe('Potato: 1.5 kg');
    expect(formatShoppingItem(en, potato!, 'us')).toBe('Potato: 3.25 lb');
    expect(formatShoppingItem(en, salt!, 'metric')).toBe('Salt');
  });

  it('shares the meals, then the ingredients', () => {
    const itemList = toShoppingItems(lineList);
    const mealList = [
      { id: 1, syncId: 'aaaaaaaaaaaaaaa', title: 'Leek soup' },
      { id: 2, syncId: 'bbbbbbbbbbbbbbb', title: 'Gratin' },
    ];

    expect(toShoppingText(en, { itemList, mealList, units: 'metric' })).toBe(
      [
        'Shopping list',
        '',
        'Meals: Leek soup, Gratin',
        '',
        '• Leek: 5 + 200 g',
        '• Potato: 1.5 kg',
        '• Salt',
      ].join('\n'),
    );
    expect(toShoppingText(fr, { itemList, mealList, units: 'metric' })).toContain(
      '• Potato\u{202F}: 1,5 kg',
    );
  });
});
