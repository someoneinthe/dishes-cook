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
});
