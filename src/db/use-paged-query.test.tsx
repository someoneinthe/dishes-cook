import { act, renderHook } from '@testing-library/react-native';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { useIngredientPages } from '@/features/ingredients/hooks/use-ingredients';
import { createDataWrapper, createTestConnection } from '@/test/test-database';
import type { DatabaseConnection } from './types';
import { MAX_PAGES, PAGE_SIZE } from './pagination';

describe('usePagedQuery', () => {
  let connection: DatabaseConnection;
  // 130 rows: pages of 50, 50 and 30.
  const NAME_LIST = Array.from(
    { length: 130 },
    (_, index) => `Item ${String(index).padStart(3, '0')}`,
  );

  beforeEach(() => {
    connection = createTestConnection();
    for (const name of NAME_LIST) {
      findOrCreateIngredient(connection.db, name);
    }
  });

  const renderPages = () =>
    renderHook(() => useIngredientPages(''), { wrapper: createDataWrapper(connection) });
  const firstAndLast = (itemList: readonly { name: string }[]) => [
    itemList[0]?.name,
    itemList.at(-1)?.name,
    itemList.length,
  ];

  it('loads one page at first, synchronously', async () => {
    const { result } = await renderPages();

    expect(firstAndLast(result.current.itemList)).toStrictEqual([
      'Item 000',
      'Item 049',
      PAGE_SIZE,
    ]);
  });

  it('keeps at most MAX_PAGES pages, dropping the first ones and reloading them going back', async () => {
    const { result } = await renderPages();

    await act(() => {
      result.current.fetchNextPage();
    });

    expect(firstAndLast(result.current.itemList)).toStrictEqual(['Item 000', 'Item 099', 100]);

    await act(() => {
      result.current.fetchNextPage();
    });

    // Page 1 dropped: pages 2 and 3 kept.
    expect(MAX_PAGES).toBe(2);
    expect(firstAndLast(result.current.itemList)).toStrictEqual(['Item 050', 'Item 129', 80]);

    await act(() => {
      result.current.fetchPreviousPage();
    });

    expect(firstAndLast(result.current.itemList)).toStrictEqual(['Item 000', 'Item 099', 100]);
  });

  it('refreshes the loaded pages after a write', async () => {
    const { result } = await renderPages();

    await act(() => {
      findOrCreateIngredient(connection.db, 'Aaa first');
    });

    expect(result.current.itemList[0]?.name).toBe('Aaa first');
  });
});
