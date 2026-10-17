import type { AppDatabase } from '@/db/types';
import type { Quantity } from '@/lib/units';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { deleteRecipe, saveRecipe } from '@/features/recipes/db/recipe-queries';
import { createTestConnection } from '@/test/test-database';
import { listPickedMeals, listShoppingLines } from './shopping-queries';

describe('shopping queries', () => {
  let database: AppDatabase;
  let leekId: number;
  let potatoId: number;
  let saltId: number;

  beforeEach(() => {
    ({ db: database } = createTestConnection());
    leekId = findOrCreateIngredient(database, 'leek').id;
    potatoId = findOrCreateIngredient(database, 'potato').id;
    saltId = findOrCreateIngredient(database, 'salt').id;
  });

  const addRecipe = (title: string, quantities: readonly (readonly [number, Quantity?])[]) =>
    saveRecipe(database, {
      ingredientIdList: quantities.map(([id]) => id),
      instructions: '',
      quantities: new Map(
        quantities.flatMap(([id, quantity]) => (quantity ? [[id, quantity] as const] : [])),
      ),
      season: 'both',
      title,
    });

  it('adds up the quantities of an ingredient in each unit, and lists each ingredient once', () => {
    const soupId = addRecipe('Leek soup', [
      [leekId, { amount: 3 }],
      [potatoId, { amount: 0.5, unit: 'kg' }],
      [saltId],
    ]);
    const pieId = addRecipe('Leek pie', [
      [leekId, { amount: 2 }],
      [potatoId, { amount: 300, unit: 'g' }],
    ]);
    const gratinId = addRecipe('Gratin', [[leekId, { amount: 200, unit: 'g' }], [saltId]]);

    expect(listShoppingLines(database, [soupId, pieId, gratinId])).toStrictEqual([
      // Pieces and grams don't add up: two lines, grams (stored normalized) and pieces.
      { amount: 5, ingredientId: leekId, name: 'Leek' },
      { amount: 200, ingredientId: leekId, name: 'Leek', unit: 'g' },
      { amount: 800, ingredientId: potatoId, name: 'Potato', unit: 'g' },
      // No quantity in any meal: listed once, without one.
      { ingredientId: saltId, name: 'Salt' },
    ]);
  });

  it('lists nothing without meals', () => {
    expect(listShoppingLines(database, [])).toStrictEqual([]);
    expect(listPickedMeals(database, [])).toStrictEqual([]);
  });

  it('lists the picked meals that still exist, by title', () => {
    const soupId = addRecipe('Leek soup', []);
    const gratinId = addRecipe('Gratin', []);
    const pieId = addRecipe('Pie', []);
    deleteRecipe(database, pieId);

    expect(listPickedMeals(database, [soupId, pieId, gratinId])).toStrictEqual([
      { id: gratinId, title: 'Gratin' },
      { id: soupId, title: 'Leek soup' },
    ]);
  });
});
