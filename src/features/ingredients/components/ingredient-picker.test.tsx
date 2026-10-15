import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import type { DatabaseConnection } from '@/db/types';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import type { Ingredient } from '../db/ingredient-queries';
import { findOrCreateIngredient } from '../db/ingredient-queries';
import { IngredientPicker } from './ingredient-picker';

// The picker as a TV runs it.
jest.mock('../../../lib/device', () => ({ isTv: true }));

function Picker() {
  const [selectedList, setSelectedList] = useState<Ingredient[]>([]);
  return (
    <IngredientPicker
      emptyMessage="No ingredients"
      label="Ingredients"
      onChange={setSelectedList}
      selectedList={selectedList}
    />
  );
}

describe('ingredientPicker on a TV', () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    jest.useFakeTimers();
    connection = createTestConnection();
    findOrCreateIngredient(connection.db, 'Leek');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives the remote focus to the chip an ingredient moved to', async () => {
    await renderWithDatabase(<Picker />, connection);

    await fireEvent.press(screen.getByRole('button', { name: 'Add Leek' }));
    await act(() => jest.runAllTimers());

    expect(screen.getByRole('button', { name: 'Remove Leek' })).toHaveProp(
      'hasTVPreferredFocus',
      true,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Leek' }));
    await act(() => jest.runAllTimers());

    await expect(screen.findByRole('button', { name: 'Add Leek' })).resolves.toHaveProp(
      'hasTVPreferredFocus',
      true,
    );
  });

  it('gives the focus to the first chip shown when the search hides the removed ingredient', async () => {
    findOrCreateIngredient(connection.db, 'Carrot');
    await renderWithDatabase(<Picker />, connection);

    await fireEvent.press(screen.getByRole('button', { name: 'Add Leek' }));
    await fireEvent.changeText(screen.getByLabelText('Search ingredients'), 'car');
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Leek' }));
    await act(() => jest.runAllTimers());

    expect(screen.queryByRole('button', { name: 'Add Leek' })).not.toBeOnTheScreen();
    await expect(screen.findByRole('button', { name: 'Add Carrot' })).resolves.toHaveProp(
      'hasTVPreferredFocus',
      true,
    );

    // Typing again: the chip doesn't take the focus back from the search field.
    await fireEvent.changeText(screen.getByLabelText('Search ingredients'), 'xyz');
    await fireEvent.changeText(screen.getByLabelText('Search ingredients'), 'car');

    await expect(screen.findByRole('button', { name: 'Add Carrot' })).resolves.toHaveProp(
      'hasTVPreferredFocus',
      false,
    );
  });

  it("doesn't give the focus once the search changed before the chip asked for it", async () => {
    await renderWithDatabase(<Picker />, connection);

    await fireEvent.press(screen.getByRole('button', { name: 'Add Leek' }));
    await fireEvent.changeText(screen.getByLabelText('Search ingredients'), 'l');
    await act(() => jest.runAllTimers());

    expect(screen.getByRole('button', { name: 'Remove Leek' })).toHaveProp(
      'hasTVPreferredFocus',
      false,
    );
  });
});
