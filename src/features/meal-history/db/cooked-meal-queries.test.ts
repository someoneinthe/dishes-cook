import type { AppDatabase } from '@/db/types';
import { cookedMeals, recipes, syncDeletions } from '@/db/schema';
import { deleteRecipe, saveRecipe } from '@/features/recipes/db/recipe-queries';
import { createTestConnection } from '@/test/test-database';
import {
  getLastCookedMeal,
  markAllCooked,
  markCooked,
  removeCookedMeal,
} from './cooked-meal-queries';

describe('cooked meal queries', () => {
  let database: AppDatabase;
  let soupId: number;

  beforeEach(() => {
    ({ db: database } = createTestConnection());
    soupId = saveRecipe(database, {
      ingredientIdList: [],
      instructions: '',
      season: 'both',
      title: 'Soup',
    });
  });

  it('knows a recipe was never cooked', () => {
    expect(getLastCookedMeal(database, soupId)).toBeUndefined();
  });

  it('finds the last time a recipe was cooked, whatever the order they were recorded in', () => {
    const lastId = markCooked(database, soupId, 3000);
    markCooked(database, soupId, 1000);

    expect(getLastCookedMeal(database, soupId)).toStrictEqual({ cookedAt: 3000, id: lastId });
  });

  it('records it now by default, without changing the recipe', () => {
    const before = Date.now();
    const recipeUpdatedAt = () =>
      database.select({ updatedAt: recipes.updatedAt }).from(recipes).get()?.updatedAt;
    const updatedAt = recipeUpdatedAt();

    markCooked(database, soupId);

    expect(getLastCookedMeal(database, soupId)?.cookedAt).toBeGreaterThanOrEqual(before - 1);
    // The recipe isn't pushed again: an edit on another phone can't be overwritten by it.
    expect(recipeUpdatedAt()).toBe(updatedAt);
  });

  it('removes a time cooked and keeps the deletion for the sync server', () => {
    const firstId = markCooked(database, soupId, 1000);
    const lastId = markCooked(database, soupId, 2000);
    const { syncId } = database
      .select()
      .from(cookedMeals)
      .all()
      .find(({ id }) => id === lastId)!;

    removeCookedMeal(database, lastId);

    expect(getLastCookedMeal(database, soupId)).toStrictEqual({ cookedAt: 1000, id: firstId });
    expect(
      database
        .select({ syncId: syncDeletions.syncId, tableName: syncDeletions.tableName })
        .from(syncDeletions)
        .all(),
    ).toStrictEqual([{ syncId, tableName: 'cooked_meals' }]);
  });

  it('marks several recipes as cooked at once', () => {
    const pieId = saveRecipe(database, {
      ingredientIdList: [],
      instructions: '',
      season: 'both',
      title: 'Pie',
    });

    markAllCooked(database, [soupId, pieId]);
    markAllCooked(database, []);

    expect(getLastCookedMeal(database, soupId)).toBeDefined();
    expect(getLastCookedMeal(database, pieId)).toBeDefined();
    expect(database.select().from(cookedMeals).all()).toHaveLength(2);
  });

  it('forgets the meals of a deleted recipe', () => {
    markCooked(database, soupId, 1000);

    deleteRecipe(database, soupId);

    expect(database.select().from(cookedMeals).all()).toStrictEqual([]);
  });
});
