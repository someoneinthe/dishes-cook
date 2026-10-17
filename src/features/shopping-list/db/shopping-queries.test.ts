import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/types';
import type { Quantity } from '@/lib/units';
import { recipes } from '@/db/schema';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { deleteRecipe, getRecipeSyncId, saveRecipe } from '@/features/recipes/db/recipe-queries';
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

  // Its sync id: the shopping list's picks.
  const addRecipe = (title: string, quantities: readonly (readonly [number, Quantity?])[]) => {
    const quantityMap = new Map(
      quantities.flatMap(([id, quantity]) => (quantity ? [[id, quantity] as const] : [])),
    );
    const id = saveRecipe(database, {
      ingredientIdList: quantities.map(([ingredientId]) => ingredientId),
      instructions: '',
      quantities: quantityMap,
      season: 'both',
      title,
    });
    return toSyncId(id);
  };
  const toSyncId = (id: number) => getRecipeSyncId(database, id)!;
  const idOf = (syncId: string) =>
    database.select({ id: recipes.id }).from(recipes).where(eq(recipes.syncId, syncId)).get()!.id;

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
    const soup = addRecipe('Leek soup', []);
    const gratin = addRecipe('Gratin', []);
    const pie = addRecipe('Pie', []);
    deleteRecipe(database, idOf(pie));

    expect(
      listPickedMeals(database, [soup, pie, gratin]).map(({ syncId, title }) => ({
        syncId,
        title,
      })),
    ).toStrictEqual([
      { syncId: gratin, title: 'Gratin' },
      { syncId: soup, title: 'Leek soup' },
    ]);
  });
});
