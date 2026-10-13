import type { AppDatabase } from '@/db/types';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { createTestConnection } from '@/test/test-database';
import {
  deleteRecipe,
  findRecipeIds,
  getRecipe,
  listRecipes,
  type RecipeFilters,
  type RecipeInput,
  saveRecipe,
} from './recipe-queries';

const soupInput: RecipeInput = {
  ingredientIdList: [],
  instructions: '  Simmer for 30 minutes.  ',
  season: 'winter',
  title: '  Carrot   soup ',
};

describe('recipe queries', () => {
  let database: AppDatabase;
  let carrotId: number;
  let leekId: number;
  let tomatoId: number;

  beforeEach(() => {
    ({ db: database } = createTestConnection());
    carrotId = findOrCreateIngredient(database, 'carrot').id;
    leekId = findOrCreateIngredient(database, 'leek').id;
    tomatoId = findOrCreateIngredient(database, 'tomato').id;
  });

  it('creates a recipe with its ingredients', () => {
    const id = saveRecipe(database, { ...soupInput, ingredientIdList: [leekId, carrotId, leekId] });

    expect(getRecipe(database, id)).toStrictEqual({
      id,
      ingredientList: [
        { id: carrotId, name: 'carrot' },
        { id: leekId, name: 'leek' },
      ],
      instructions: 'Simmer for 30 minutes.',
      season: 'winter',
      title: 'Carrot soup',
    });
  });

  it('updates a recipe and replaces its ingredients', () => {
    const id = saveRecipe(database, { ...soupInput, ingredientIdList: [carrotId, leekId] });

    saveRecipe(
      database,
      { ...soupInput, ingredientIdList: [leekId, tomatoId], season: 'both', title: 'Leek soup' },
      id,
    );

    expect(getRecipe(database, id)).toMatchObject({
      ingredientList: [
        { id: leekId, name: 'leek' },
        { id: tomatoId, name: 'tomato' },
      ],
      season: 'both',
      title: 'Leek soup',
    });
  });

  it('refuses a blank title and an unknown recipe', () => {
    expect(() => saveRecipe(database, { ...soupInput, title: ' ' })).toThrow('cannot be blank');
    expect(() => saveRecipe(database, soupInput, 999)).toThrow('does not exist');
  });

  it('rolls back the whole save when an ingredient does not exist', () => {
    expect(() => saveRecipe(database, { ...soupInput, ingredientIdList: [carrotId, 999] })).toThrow(
      'FOREIGN KEY',
    );
    expect(listRecipes(database)).toStrictEqual([]);
  });

  it('lists recipes by title with their ingredient count', () => {
    saveRecipe(database, { ...soupInput, ingredientIdList: [carrotId, leekId], title: 'Soup' });
    saveRecipe(database, { ...soupInput, season: 'summer', title: 'Été salad' });

    expect(listRecipes(database)).toStrictEqual([
      expect.objectContaining({ ingredientCount: 0, season: 'summer', title: 'Été salad' }),
      expect.objectContaining({ ingredientCount: 2, season: 'winter', title: 'Soup' }),
    ]);
  });

  it('deletes a recipe and its ingredient links, but not the ingredients', () => {
    const id = saveRecipe(database, { ...soupInput, ingredientIdList: [carrotId] });

    deleteRecipe(database, id);

    expect(getRecipe(database, id)).toBeUndefined();
    expect(findRecipeIds(database, { ingredientIdList: [carrotId] })).toStrictEqual([]);
    expect(findOrCreateIngredient(database, 'carrot').isNew).toBe(false);
  });

  describe('findRecipeIds', () => {
    // The order of the ids doesn't matter (one is picked at random).
    const findSortedIds = (filters: RecipeFilters) =>
      [...findRecipeIds(database, filters)].sort((left, right) => left - right);

    let winterSoupId: number;
    let summerSaladId: number;
    let allYearStewId: number;

    beforeEach(() => {
      winterSoupId = saveRecipe(database, {
        ...soupInput,
        ingredientIdList: [carrotId, leekId],
        season: 'winter',
      });
      summerSaladId = saveRecipe(database, {
        ...soupInput,
        ingredientIdList: [carrotId, tomatoId],
        season: 'summer',
      });
      allYearStewId = saveRecipe(database, {
        ...soupInput,
        ingredientIdList: [carrotId, leekId, tomatoId],
        season: 'both',
      });
    });

    it('returns every recipe without filters', () => {
      expect(findSortedIds({ ingredientIdList: [] })).toStrictEqual([
        winterSoupId,
        summerSaladId,
        allYearStewId,
      ]);
    });

    it('includes the recipes for both seasons in a season', () => {
      expect(findSortedIds({ ingredientIdList: [], season: 'winter' })).toStrictEqual([
        winterSoupId,
        allYearStewId,
      ]);
    });

    it('keeps the recipes containing all the selected ingredients', () => {
      expect(findSortedIds({ ingredientIdList: [leekId] })).toStrictEqual([
        winterSoupId,
        allYearStewId,
      ]);
      expect(findSortedIds({ ingredientIdList: [leekId, tomatoId, leekId] })).toStrictEqual([
        allYearStewId,
      ]);
    });

    it('combines season and ingredients', () => {
      expect(findSortedIds({ ingredientIdList: [tomatoId], season: 'summer' })).toStrictEqual([
        summerSaladId,
        allYearStewId,
      ]);
      expect(findSortedIds({ ingredientIdList: [leekId], season: 'summer' })).toStrictEqual([
        allYearStewId,
      ]);
    });
  });
});
