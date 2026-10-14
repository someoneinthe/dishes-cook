import type { AppDatabase } from '@/db/types';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { firstRecipePage } from '@/test/queries';
import { createTestConnection } from '@/test/test-database';
import {
  countRecipes,
  deleteRecipe,
  getRecipe,
  pickRandomRecipeId,
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
      // A main course when none is given.
      course: 'main',
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

  it('sets and changes the course', () => {
    const id = saveRecipe(database, { ...soupInput, course: 'starter' });

    expect(getRecipe(database, id)?.course).toBe('starter');

    saveRecipe(database, { ...soupInput, course: 'main' }, id);

    expect(firstRecipePage(database)).toStrictEqual([expect.objectContaining({ course: 'main' })]);
  });

  it('refuses a blank title and an unknown recipe', () => {
    expect(() => saveRecipe(database, { ...soupInput, title: ' ' })).toThrow('cannot be blank');
    expect(() => saveRecipe(database, soupInput, 999)).toThrow('does not exist');
  });

  it('rolls back the whole save when an ingredient does not exist', () => {
    expect(() => saveRecipe(database, { ...soupInput, ingredientIdList: [carrotId, 999] })).toThrow(
      'FOREIGN KEY',
    );
    expect(firstRecipePage(database)).toStrictEqual([]);
  });

  it('lists recipes by title with their ingredient count', () => {
    saveRecipe(database, { ...soupInput, ingredientIdList: [carrotId, leekId], title: 'Soup' });
    saveRecipe(database, { ...soupInput, season: 'summer', title: 'Été salad' });

    expect(firstRecipePage(database)).toStrictEqual([
      expect.objectContaining({ ingredientCount: 0, season: 'summer', title: 'Été salad' }),
      expect.objectContaining({ ingredientCount: 2, season: 'winter', title: 'Soup' }),
    ]);
  });

  it('deletes a recipe and its ingredient links, but not the ingredients', () => {
    const id = saveRecipe(database, { ...soupInput, ingredientIdList: [carrotId] });

    deleteRecipe(database, id);

    expect(getRecipe(database, id)).toBeUndefined();
    expect(countRecipes(database, { ingredientIdList: [carrotId] })).toBe(0);
    expect(findOrCreateIngredient(database, 'carrot').isNew).toBe(false);
  });

  describe('filters and random pick', () => {
    // Every id the pick can return, in id order: one random value per offset.
    const findSortedIds = (filters: RecipeFilters) => {
      const total = countRecipes(database, filters);
      return Array.from({ length: total }, (_, index) =>
        pickRandomRecipeId(database, filters, undefined, () => index / total),
      );
    };

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
        course: 'starter',
        ingredientIdList: [carrotId, tomatoId],
        season: 'summer',
      });
      allYearStewId = saveRecipe(database, {
        ...soupInput,
        course: 'main',
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

    it('keeps the recipes of the course (a main course when saved without one)', () => {
      expect(findSortedIds({ course: 'main', ingredientIdList: [] })).toStrictEqual([
        winterSoupId,
        allYearStewId,
      ]);
      expect(
        findSortedIds({ course: 'starter', ingredientIdList: [tomatoId], season: 'summer' }),
      ).toStrictEqual([summerSaladId]);
      expect(findSortedIds({ course: 'dessert', ingredientIdList: [] })).toStrictEqual([]);
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

    it('never picks the excluded recipe when another one matches', () => {
      const winterFilters = { ingredientIdList: [], season: 'winter' } as const;

      expect(pickRandomRecipeId(database, winterFilters, winterSoupId, () => 0)).toBe(
        allYearStewId,
      );
      expect(pickRandomRecipeId(database, winterFilters, allYearStewId, () => 0.99)).toBe(
        winterSoupId,
      );
    });

    it('picks the excluded recipe again when it is the only match', () => {
      const filters = { ingredientIdList: [leekId], season: 'summer' } as const;

      expect(pickRandomRecipeId(database, filters, allYearStewId)).toBe(allYearStewId);
    });

    it('picks nothing when no recipe matches', () => {
      expect(pickRandomRecipeId(database, { ingredientIdList: [leekId, 999] })).toBeUndefined();
    });
  });
});
