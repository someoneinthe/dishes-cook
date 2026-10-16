import type { AppDatabase } from '@/db/types';
import { ingredients } from '@/db/schema';
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

  it('saves names in lowercase and shows them with a capital first letter', () => {
    const wine = findOrCreateIngredient(database, 'VIN Rouge');
    renameIngredient(database, findOrCreateIngredient(database, 'Œuf').id, 'ŒUF DE CAILLE');
    const savedNameList = database
      .select({ name: ingredients.name })
      .from(ingredients)
      .orderBy(ingredients.sortKey)
      .all()
      .map(({ name }) => name);

    expect(wine.name).toBe('Vin rouge');
    expect(savedNameList).toStrictEqual(['vin rouge', 'œuf de caille']);
    expect(firstIngredientPage(database).map(({ name }) => name)).toStrictEqual([
      'Vin rouge',
      'Œuf de caille',
    ]);
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
      name: 'Poireau',
    });
    expect(findSimilarIngredient(database, 'pâté')).toStrictEqual({ id: pate.id, name: 'Pâte' });
  });

  it('finds an ingredient whose name is in the new one as whole words, the longest first', () => {
    findOrCreateIngredient(database, 'vin');
    const redWine = findOrCreateIngredient(database, 'Vin rouge');
    const salt = findOrCreateIngredient(database, 'Sel');

    expect(findSimilarIngredient(database, 'bouteille de vin rouge assez bon')).toStrictEqual({
      id: redWine.id,
      name: 'Vin rouge',
    });
    expect(findSimilarIngredient(database, 'Sel, poivre')).toStrictEqual({
      id: salt.id,
      name: 'Sel',
    });
    expect(findSimilarIngredient(database, 'selle d’agneau')).toBeUndefined();
  });

  it('compares whole words whatever the apostrophes', () => {
    const lamb = findOrCreateIngredient(database, 'Gigot d’agneau');
    const chop = findOrCreateIngredient(database, "Côte d'agneau");

    expect(findSimilarIngredient(database, "un gigot d'agneau fermier")).toStrictEqual({
      id: lamb.id,
      name: 'Gigot d’agneau',
    });
    expect(findSimilarIngredient(database, 'côte d’agneau grillée')).toStrictEqual({
      id: chop.id,
      name: "Côte d'agneau",
    });
  });

  it('finds no similar ingredient for the same name or an unrelated one', () => {
    findOrCreateIngredient(database, 'Carrots');

    expect(findSimilarIngredient(database, 'carrots')).toBeUndefined();
    expect(findSimilarIngredient(database, 'pumpkin')).toBeUndefined();
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
      { id: carrot.id, name: 'Carrot', recipeCount: 2, sortKey: 'carrot' },
      { id: shallot.id, name: 'Échalote', recipeCount: 1, sortKey: 'echalote' },
      expect.objectContaining({ name: 'Zucchini', recipeCount: 0 }),
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
      'Carrot',
      'Leek',
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
      'Carrot',
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

    expect(suggest({})).toStrictEqual(['Carrot', 'Baby carrot', 'Carrot cake spice']);
    expect(suggest({ excludeIdList: [carrot.id], limit: 1 })).toStrictEqual(['Baby carrot']);
    expect(suggest({ isUsedOnly: true })).toStrictEqual(['Baby carrot']);
    expect(suggest({ search: '' }).at(0)).toBe('Baby carrot');
    expect(carrotCake.isNew).toBe(true);
  });
});
