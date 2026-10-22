import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/types';
import { recipes } from '@/db/schema';
import {
  findIngredientByName,
  findOrCreateIngredient,
} from '@/features/ingredients/db/ingredient-queries';
import { markCooked } from '@/features/meal-history/db/cooked-meal-queries';
import { firstRecipePage } from '@/test/queries';
import { createTestConnection } from '@/test/test-database';
import {
  countRecipes,
  deleteRecipe,
  getRecipe,
  getRecipeSyncId,
  listRecipePage,
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
        { id: carrotId, name: 'Carrot' },
        { id: leekId, name: 'Leek' },
      ],
      instructions: 'Simmer for 30 minutes.',
      // A dish when none is given.
      kind: 'dish',
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
        { id: leekId, name: 'Leek' },
        { id: tomatoId, name: 'Tomato' },
      ],
      season: 'both',
      title: 'Leek soup',
    });
  });

  // Weights are stored in grams, volumes in millilitres; spoons and counted units as written.
  it('saves the quantities of its ingredients, and changes or clears them', () => {
    const id = saveRecipe(database, {
      ...soupInput,
      ingredientIdList: [carrotId, leekId, tomatoId],
      quantities: new Map([
        [carrotId, { amount: 0.5, unit: 'kg' }],
        [leekId, { amount: 2 }],
      ]),
    });

    expect(getRecipe(database, id)?.ingredientList).toStrictEqual([
      { id: carrotId, name: 'Carrot', quantity: { amount: 500, unit: 'g' } },
      { id: leekId, name: 'Leek', quantity: { amount: 2 } },
      { id: tomatoId, name: 'Tomato' },
    ]);

    saveRecipe(
      database,
      {
        ...soupInput,
        ingredientIdList: [carrotId, leekId, tomatoId],
        quantities: new Map([
          [carrotId, { amount: 0.5, unit: 'kg' }],
          [tomatoId, { amount: 1, unit: 'can' }],
        ]),
      },
      id,
    );

    expect(getRecipe(database, id)?.ingredientList).toStrictEqual([
      { id: carrotId, name: 'Carrot', quantity: { amount: 500, unit: 'g' } },
      { id: leekId, name: 'Leek' },
      { id: tomatoId, name: 'Tomato', quantity: { amount: 1, unit: 'can' } },
    ]);
  });

  it('saves no quantity for an amount that is not usable', () => {
    const id = saveRecipe(database, {
      ...soupInput,
      ingredientIdList: [carrotId, leekId],
      quantities: new Map([
        [carrotId, { amount: -1, unit: 'g' }],
        [leekId, { amount: Infinity }],
      ]),
    });

    expect(getRecipe(database, id)?.ingredientList).toStrictEqual([
      { id: carrotId, name: 'Carrot' },
      { id: leekId, name: 'Leek' },
    ]);
  });

  // Ingredients read from a photo are created only when the recipe is saved.
  it('creates the new ingredients with the recipe, reusing one that exists by then', () => {
    const id = saveRecipe(database, {
      ...soupInput,
      ingredientIdList: [carrotId, -1, -2],
      newIngredientNames: new Map([
        [-2, 'Leek'],
        [-1, 'Celery'],
      ]),
      quantities: new Map([[-1, { amount: 2 }]]),
    });

    const celeryId = findIngredientByName(database, 'celery')?.id;

    expect(getRecipe(database, id)?.ingredientList).toStrictEqual([
      { id: carrotId, name: 'Carrot' },
      { id: celeryId, name: 'Celery', quantity: { amount: 2 } },
      { id: leekId, name: 'Leek' },
    ]);
  });

  it('only creates the new ingredients the recipe still has', () => {
    saveRecipe(database, {
      ...soupInput,
      ingredientIdList: [carrotId],
      newIngredientNames: new Map([[-1, 'Celery']]),
    });

    expect(findIngredientByName(database, 'Celery')).toBeUndefined();
  });

  it('creates no new ingredient when the save fails', () => {
    expect(() =>
      saveRecipe(database, {
        ...soupInput,
        ingredientIdList: [999, -1],
        newIngredientNames: new Map([[-1, 'Celery']]),
      }),
    ).toThrow('FOREIGN KEY');
    expect(findIngredientByName(database, 'Celery')).toBeUndefined();
  });

  it('sets and changes the course', () => {
    const id = saveRecipe(database, { ...soupInput, course: 'starter' });

    expect(getRecipe(database, id)?.course).toBe('starter');

    saveRecipe(database, { ...soupInput, course: 'main' }, id);

    expect(firstRecipePage(database)).toStrictEqual([expect.objectContaining({ course: 'main' })]);
  });

  it('keeps dishes and drinks apart in lists, counts and random picks', () => {
    const soupId = saveRecipe(database, soupInput);
    const mojitoId = saveRecipe(database, { ...soupInput, kind: 'drink', title: 'Mojito' });
    const page = (kind: 'dish' | 'drink') =>
      listRecipePage(database, {
        filters: { ingredientIdList: [], kind },
        pageParam: null,
      }).itemList.map(({ id }) => id);

    expect(page('dish')).toStrictEqual([soupId]);
    expect(page('drink')).toStrictEqual([mojitoId]);
    expect(countRecipes(database, { ingredientIdList: [], kind: 'drink' })).toBe(1);
    expect(pickRandomRecipeId(database, { ingredientIdList: [], kind: 'dish' })).toBe(soupId);

    // An edit that doesn't say keeps the kind.
    saveRecipe(database, { ...soupInput, title: 'Mojito' }, mojitoId);

    expect(getRecipe(database, mojitoId)?.kind).toBe('drink');
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

  it('saves the preparation and cooking times, and leaves them out when not given', () => {
    const id = saveRecipe(database, { ...soupInput, cookMinutes: 30, prepMinutes: 15 });

    expect(getRecipe(database, id)).toMatchObject({ cookMinutes: 30, prepMinutes: 15 });

    saveRecipe(database, { ...soupInput, cookMinutes: null, prepMinutes: 0 }, id);

    expect(getRecipe(database, id)).not.toHaveProperty('cookMinutes');
    expect(getRecipe(database, id)).not.toHaveProperty('prepMinutes');
  });

  describe('photo', () => {
    const photoColumnsOf = (id: number) =>
      database
        .select({
          photoFile: recipes.photoFile,
          photoPending: recipes.photoPending,
          photoSynced: recipes.photoSynced,
        })
        .from(recipes)
        .where(eq(recipes.id, id))
        .get();

    it('keeps a new photo, to upload (no server copy yet)', () => {
      const id = saveRecipe(database, { ...soupInput, photo: { file: 'a.jpg' } });

      expect(getRecipe(database, id)?.photoFile).toBe('a.jpg');
      expect(photoColumnsOf(id)).toStrictEqual({
        photoFile: 'a.jpg',
        photoPending: null,
        photoSynced: null,
      });
    });

    it('leaves the photo as it is when the form doesn’t change it', () => {
      const id = saveRecipe(database, { ...soupInput, photo: { file: 'a.jpg' } });
      database.update(recipes).set({ photoSynced: 'photo_x.jpg' }).where(eq(recipes.id, id)).run();

      saveRecipe(database, { ...soupInput, title: 'Leek soup' }, id);

      expect(photoColumnsOf(id)).toMatchObject({ photoFile: 'a.jpg', photoSynced: 'photo_x.jpg' });
    });

    it('removes the photo and remembers the server’s copy, for the sync to remove it there', () => {
      const id = saveRecipe(database, { ...soupInput, photo: { file: 'a.jpg' } });
      database.update(recipes).set({ photoSynced: 'photo_x.jpg' }).where(eq(recipes.id, id)).run();

      saveRecipe(database, { ...soupInput, photo: null }, id);

      expect(getRecipe(database, id)).not.toHaveProperty('photoFile');
      expect(photoColumnsOf(id)).toMatchObject({ photoFile: null, photoSynced: 'photo_x.jpg' });
    });
  });

  it('deletes a recipe and its ingredient links, but not the ingredients', () => {
    const id = saveRecipe(database, { ...soupInput, ingredientIdList: [carrotId] });

    deleteRecipe(database, id);

    expect(getRecipe(database, id)).toBeUndefined();
    expect(countRecipes(database, { ingredientIdList: [carrotId], kind: 'dish' })).toBe(0);
    expect(findOrCreateIngredient(database, 'carrot').isNew).toBe(false);
  });

  describe('filters and random pick', () => {
    // Every id the pick can return, in id order: one random value per offset.
    const findSortedIds = (filters: RecipeFilters) => {
      const total = countRecipes(database, filters);
      return Array.from({ length: total }, (_, index) =>
        pickRandomRecipeId(database, filters, { random: () => index / total }),
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
      expect(findSortedIds({ ingredientIdList: [], kind: 'dish' })).toStrictEqual([
        winterSoupId,
        summerSaladId,
        allYearStewId,
      ]);
    });

    it("keeps mine: my account's and those not on the server yet", () => {
      const setAuthor = (id: number, createdBy: string) =>
        database.update(recipes).set({ createdBy }).where(eq(recipes.id, id)).run();
      setAuthor(winterSoupId, 'a00000000000001');
      // Another account's, and one pulled without an author.
      setAuthor(summerSaladId, 'b00000000000002');
      const pulledWithoutAuthorId = saveRecipe(database, soupInput);
      setAuthor(pulledWithoutAuthorId, '');
      const mineOf = (accountId: string | undefined): RecipeFilters => ({
        ingredientIdList: [],
        kind: 'dish',
        mine: { accountId },
      });

      expect(findSortedIds(mineOf('a00000000000001'))).toStrictEqual([winterSoupId, allYearStewId]);
      expect(countRecipes(database, mineOf('a00000000000001'))).toBe(2);
      // The account not known yet (connected before it was kept): only the phone's own.
      expect(findSortedIds(mineOf(undefined))).toStrictEqual([allYearStewId]);
    });

    it('includes the recipes for both seasons in a season', () => {
      expect(findSortedIds({ ingredientIdList: [], kind: 'dish', season: 'winter' })).toStrictEqual(
        [winterSoupId, allYearStewId],
      );
    });

    it('keeps the recipes of the course (a main course when saved without one)', () => {
      expect(findSortedIds({ course: 'main', ingredientIdList: [], kind: 'dish' })).toStrictEqual([
        winterSoupId,
        allYearStewId,
      ]);
      expect(
        findSortedIds({
          course: 'starter',
          ingredientIdList: [tomatoId],
          kind: 'dish',
          season: 'summer',
        }),
      ).toStrictEqual([summerSaladId]);
      expect(
        findSortedIds({ course: 'dessert', ingredientIdList: [], kind: 'dish' }),
      ).toStrictEqual([]);
    });

    it('keeps the recipes containing all the selected ingredients', () => {
      expect(findSortedIds({ ingredientIdList: [leekId], kind: 'dish' })).toStrictEqual([
        winterSoupId,
        allYearStewId,
      ]);
      expect(
        findSortedIds({ ingredientIdList: [leekId, tomatoId, leekId], kind: 'dish' }),
      ).toStrictEqual([allYearStewId]);
    });

    it('combines season and ingredients', () => {
      expect(
        findSortedIds({ ingredientIdList: [tomatoId], kind: 'dish', season: 'summer' }),
      ).toStrictEqual([summerSaladId, allYearStewId]);
      expect(
        findSortedIds({ ingredientIdList: [leekId], kind: 'dish', season: 'summer' }),
      ).toStrictEqual([allYearStewId]);
    });

    it('never picks the excluded recipe when another one matches', () => {
      const winterFilters = { ingredientIdList: [], kind: 'dish', season: 'winter' } as const;

      expect(
        pickRandomRecipeId(database, winterFilters, { excludedId: winterSoupId, random: () => 0 }),
      ).toBe(allYearStewId);
      expect(
        pickRandomRecipeId(database, winterFilters, {
          excludedId: allYearStewId,
          random: () => 0.99,
        }),
      ).toBe(winterSoupId);
    });

    it('picks the excluded recipe again when it is the only match', () => {
      const filters = { ingredientIdList: [leekId], kind: 'dish', season: 'summer' } as const;

      expect(pickRandomRecipeId(database, filters, { excludedId: allYearStewId })).toBe(
        allYearStewId,
      );
    });

    it('picks nothing when no recipe matches', () => {
      expect(
        pickRandomRecipeId(database, { ingredientIdList: [leekId, 999], kind: 'dish' }),
      ).toBeUndefined();
    });

    it('never picks the recipes left out (those in the shopping list)', () => {
      const winterFilters = { ingredientIdList: [], kind: 'dish', season: 'winter' } as const;

      expect(
        [0, 0.5, 0.99].map((value) =>
          pickRandomRecipeId(database, winterFilters, {
            omittedSyncIdList: [getRecipeSyncId(database, winterSoupId)!],
            random: () => value,
          }),
        ),
      ).toStrictEqual([allYearStewId, allYearStewId, allYearStewId]);
      expect(
        pickRandomRecipeId(database, winterFilters, {
          omittedSyncIdList: [
            getRecipeSyncId(database, winterSoupId)!,
            getRecipeSyncId(database, allYearStewId)!,
          ],
        }),
      ).toBeUndefined();
    });

    describe('skipping the recipes cooked recently', () => {
      const DAY = 24 * 60 * 60 * 1000;
      const now = Date.UTC(2026, 9, 17, 12);
      const lastWeek = now - 7 * DAY;
      const winterFilters = { ingredientIdList: [], kind: 'dish', season: 'winter' } as const;
      // Every id the pick can return when skipping the meals cooked in the last week.
      const findSkippingIds = () =>
        [0, 0.5, 0.99].map((value) =>
          pickRandomRecipeId(database, winterFilters, {
            random: () => value,
            skipCookedSince: lastWeek,
          }),
        );

      it('never picks a recipe cooked since then while another one matches', () => {
        markCooked(database, winterSoupId, now - DAY);

        expect(new Set(findSkippingIds())).toStrictEqual(new Set([allYearStewId]));
      });

      it('picks again the recipes cooked before then', () => {
        markCooked(database, winterSoupId, now - 10 * DAY);

        expect(new Set(findSkippingIds())).toStrictEqual(new Set([allYearStewId, winterSoupId]));
      });

      it('picks the recipe cooked longest ago when all matches were cooked since then', () => {
        markCooked(database, winterSoupId, now - 6 * DAY);
        markCooked(database, winterSoupId, now - 3 * DAY);
        markCooked(database, allYearStewId, now - 5 * DAY);

        expect(new Set(findSkippingIds())).toStrictEqual(new Set([allYearStewId]));
        // Asking again: the next one cooked longest ago.
        expect(
          pickRandomRecipeId(database, winterFilters, {
            excludedId: allYearStewId,
            skipCookedSince: lastWeek,
          }),
        ).toBe(winterSoupId);
      });

      it('still never picks the excluded recipe when another one was not cooked', () => {
        markCooked(database, allYearStewId, now - DAY);

        expect(
          pickRandomRecipeId(database, winterFilters, {
            excludedId: winterSoupId,
            skipCookedSince: lastWeek,
          }),
        ).toBe(winterSoupId);
        expect(
          pickRandomRecipeId(database, winterFilters, {
            excludedId: allYearStewId,
            skipCookedSince: lastWeek,
          }),
        ).toBe(winterSoupId);
      });

      it('ignores the meals of the recipes that do not match', () => {
        markCooked(database, summerSaladId, now - DAY);

        expect(new Set(findSkippingIds())).toStrictEqual(new Set([allYearStewId, winterSoupId]));
      });
    });
  });
});
