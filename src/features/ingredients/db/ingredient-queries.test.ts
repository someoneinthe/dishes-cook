import type { AppDatabase } from '@/db/types';
import { saveRecipe } from '@/features/recipes/db/recipe-queries';
import { createTestConnection } from '@/test/test-database';
import {
  deleteIngredient,
  findOrCreateIngredient,
  listIngredients,
  renameIngredient,
} from './ingredient-queries';

describe('ingredient queries', () => {
  let database: AppDatabase;

  beforeEach(() => {
    ({ db: database } = createTestConnection());
  });

  it('creates an ingredient once, whatever the case and spacing', () => {
    const created = findOrCreateIngredient(database, '  Œuf ');
    const again = findOrCreateIngredient(database, 'œUF');

    expect(created).toStrictEqual({ id: created.id, isNew: true, name: 'Œuf' });
    expect(again).toStrictEqual({ id: created.id, isNew: false, name: 'Œuf' });
    expect(listIngredients(database)).toHaveLength(1);
  });

  it('keeps accents significant', () => {
    findOrCreateIngredient(database, 'pâte');
    findOrCreateIngredient(database, 'pâté');

    expect(listIngredients(database)).toHaveLength(2);
  });

  it('refuses a blank name', () => {
    expect(() => findOrCreateIngredient(database, ' '.repeat(3))).toThrow('cannot be blank');
  });

  it('lists ingredients by name with the number of recipes using them', () => {
    const carrot = findOrCreateIngredient(database, 'carrot');
    const shallot = findOrCreateIngredient(database, 'Échalote');
    findOrCreateIngredient(database, 'zucchini');
    saveRecipe(database, {
      ingredientIdList: [carrot.id, shallot.id],
      instructions: '',
      season: 'winter',
      title: 'Soup',
    });
    saveRecipe(database, {
      ingredientIdList: [carrot.id],
      instructions: '',
      season: 'both',
      title: 'Salad',
    });

    expect(listIngredients(database)).toStrictEqual([
      { id: carrot.id, name: 'carrot', recipeCount: 2 },
      { id: shallot.id, name: 'Échalote', recipeCount: 1 },
      expect.objectContaining({ name: 'zucchini', recipeCount: 0 }),
    ]);
  });

  it('renames an ingredient unless the name is taken or blank', () => {
    const carrot = findOrCreateIngredient(database, 'carot');
    findOrCreateIngredient(database, 'leek');

    expect(renameIngredient(database, carrot.id, 'LEEK')).toBe('duplicate');
    expect(renameIngredient(database, carrot.id, ' ')).toBe('blank');
    expect(renameIngredient(database, carrot.id, 'Carrot')).toBe('renamed');
    expect(renameIngredient(database, carrot.id, 'carrot')).toBe('renamed');
    expect(listIngredients(database).map((ingredient) => ingredient.name)).toStrictEqual([
      'carrot',
      'leek',
    ]);
  });

  it('only deletes ingredients that no recipe uses', () => {
    const carrot = findOrCreateIngredient(database, 'carrot');
    const leek = findOrCreateIngredient(database, 'leek');
    saveRecipe(database, {
      ingredientIdList: [carrot.id],
      instructions: '',
      season: 'both',
      title: 'Soup',
    });

    expect(deleteIngredient(database, carrot.id)).toBe('in-use');
    expect(deleteIngredient(database, leek.id)).toBe('deleted');
    expect(listIngredients(database).map((ingredient) => ingredient.name)).toStrictEqual([
      'carrot',
    ]);
  });
});
