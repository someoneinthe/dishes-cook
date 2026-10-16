import type { IngredientListItem } from '@/features/ingredients/db/ingredient-queries';
import {
  findOrCreateIngredient,
  listIngredientPage,
} from '@/features/ingredients/db/ingredient-queries';
import { createTestConnection } from '@/test/test-database';
import type { AppDatabase } from './types';
import { PAGE_SIZE } from './pagination';

describe('keyset pagination', () => {
  let database: AppDatabase;
  // 120 ingredients: 3 pages (50, 50, 20). Zero-padded so the alphabetical order is the numeric one.
  const NAME_LIST = Array.from(
    { length: 120 },
    (_, index) => `Item ${String(index).padStart(3, '0')}`,
  );

  beforeEach(() => {
    ({ db: database } = createTestConnection());
    for (const name of NAME_LIST) {
      findOrCreateIngredient(database, name);
    }
  });

  const names = (itemList: IngredientListItem[]) => itemList.map((item) => item.name);

  it('reads the list forward, PAGE_SIZE rows at a time', () => {
    const first = listIngredientPage(database, { pageParam: null, search: '' });
    const second = listIngredientPage(database, {
      pageParam: { after: first.nextCursor! },
      search: '',
    });
    const third = listIngredientPage(database, {
      pageParam: { after: second.nextCursor! },
      search: '',
    });

    expect(first.itemList).toHaveLength(PAGE_SIZE);
    expect(first.previousCursor).toBeUndefined();
    expect(third.nextCursor).toBeUndefined();
    expect([
      ...names(first.itemList),
      ...names(second.itemList),
      ...names(third.itemList),
    ]).toStrictEqual(NAME_LIST);
  });

  it('reads the page before a cursor, in order', () => {
    const first = listIngredientPage(database, { pageParam: null, search: '' });
    const second = listIngredientPage(database, {
      pageParam: { after: first.nextCursor! },
      search: '',
    });
    const before = listIngredientPage(database, {
      pageParam: { before: second.previousCursor! },
      search: '',
    });

    expect(names(before.itemList)).toStrictEqual(names(first.itemList));
    expect(before.previousCursor).toBeUndefined();
    expect(before.nextCursor).toStrictEqual(first.nextCursor);
  });

  it('sorts without case or accents and searches the same way', () => {
    findOrCreateIngredient(database, 'Échalote');
    findOrCreateIngredient(database, 'ail');

    const page = listIngredientPage(database, { pageParam: null, search: '' });
    const found = listIngredientPage(database, { pageParam: null, search: 'ECHA' });

    expect(names(page.itemList).slice(0, 2)).toStrictEqual(['Ail', 'Échalote']);
    expect(names(found.itemList)).toStrictEqual(['Échalote']);
  });

  it('treats % and _ in a search as plain text', () => {
    findOrCreateIngredient(database, '100% cocoa');

    expect(
      names(listIngredientPage(database, { pageParam: null, search: '%' }).itemList),
    ).toStrictEqual(['100% cocoa']);
    expect(listIngredientPage(database, { pageParam: null, search: '_' }).itemList).toStrictEqual(
      [],
    );
  });
});
