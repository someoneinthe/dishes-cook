import type { AppDatabase } from '@/db/types';
import { saveRecipe } from '@/features/recipes/db/recipe-queries';
import { firstIngredientPage } from '@/test/queries';
import { createTestConnection } from '@/test/test-database';
import {
  deleteIngredient,
  findOrCreateIngredient,
  findSimilarIngredient,
  renameIngredient,
  suggestIngredients,
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
    expect(firstIngredientPage(database)).toHaveLength(1);
  });

  it('keeps accents significant', () => {
    findOrCreateIngredient(database, 'pâte');
    findOrCreateIngredient(database, 'pâté');

    expect(firstIngredientPage(database)).toHaveLength(2);
  });

  it('finds an ingredient written in the other number or with other accents', () => {
    const carrots = findOrCreateIngredient(database, 'Carrots');
    const leek = findOrCreateIngredient(database, 'poireau');
    const pate = findOrCreateIngredient(database, 'Pâte');

    expect(findSimilarIngredient(database, 'carrot')).toStrictEqual({
      id: carrots.id,
      name: 'Carrots',
    });
    expect(findSimilarIngredient(database, 'Poireaux')).toStrictEqual({
      id: leek.id,
      name: 'poireau',
    });
    expect(findSimilarIngredient(database, 'pâté')).toStrictEqual({ id: pate.id, name: 'Pâte' });
  });

  it('finds no similar ingredient for the same name or an unrelated one', () => {
    findOrCreateIngredient(database, 'Carrots');

    expect(findSimilarIngredient(database, 'carrots')).toBeUndefined();
    expect(findSimilarIngredient(database, 'carrot cake')).toBeUndefined();
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

    expect(firstIngredientPage(database)).toStrictEqual([
      { id: carrot.id, name: 'carrot', recipeCount: 2, sortKey: 'carrot' },
      { id: shallot.id, name: 'Échalote', recipeCount: 1, sortKey: 'echalote' },
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
    expect(firstIngredientPage(database).map((ingredient) => ingredient.name)).toStrictEqual([
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
    expect(firstIngredientPage(database).map((ingredient) => ingredient.name)).toStrictEqual([
      'carrot',
    ]);
  });

  it('suggests the exact name first, then the most used, without the excluded ones', () => {
    const carrot = findOrCreateIngredient(database, 'carrot');
    const carrotCake = findOrCreateIngredient(database, 'carrot cake spice');
    const babyCarrot = findOrCreateIngredient(database, 'baby carrot');
    findOrCreateIngredient(database, 'leek');
    saveRecipe(database, {
      ingredientIdList: [babyCarrot.id],
      instructions: '',
      season: 'both',
      title: 'Soup',
    });
    const suggest = (options: Partial<Parameters<typeof suggestIngredients>[1]>) =>
      suggestIngredients(database, {
        excludeIdList: [],
        isUsedOnly: false,
        limit: 12,
        search: 'carrot',
        ...options,
      }).map((ingredient) => ingredient.name);

    expect(suggest({})).toStrictEqual(['carrot', 'baby carrot', 'carrot cake spice']);
    expect(suggest({ excludeIdList: [carrot.id], limit: 1 })).toStrictEqual(['baby carrot']);
    expect(suggest({ isUsedOnly: true })).toStrictEqual(['baby carrot']);
    expect(suggest({ search: '' }).at(0)).toBe('baby carrot');
    expect(carrotCake.isNew).toBe(true);
  });
});
