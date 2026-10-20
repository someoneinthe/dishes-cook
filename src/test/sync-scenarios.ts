import { asc, eq } from 'drizzle-orm';
import type { SyncedTable } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { PhotoStore, SyncCursors } from '@/features/sync/sync-engine';
import { cookedMeals, ingredients, recipes, syncDeletions } from '@/db/schema';
import {
  deleteIngredient,
  findIngredientByName,
  findOrCreateIngredient,
} from '@/features/ingredients/db/ingredient-queries';
import {
  getLastCookedMeal,
  markCooked,
  removeCookedMeal,
} from '@/features/meal-history/db/cooked-meal-queries';
import { deleteRecipe, getRecipe, saveRecipe } from '@/features/recipes/db/recipe-queries';
import { createSyncApi, signIn } from '@/features/sync/sync-api';
import { INITIAL_CURSORS, synchronize } from '@/features/sync/sync-engine';
import { toDisplayName } from '@/lib/text';
import { createTestConnection } from './test-database';

// A phone; `photos` keeps its recipe photos' files when the scenario syncs them.
export type Phone = { cursors: SyncCursors; db: AppDatabase; photos?: TestPhotos };

// A phone's photo files, in memory (base64 contents by file name), as the sync reads and writes them.
export type TestPhotos = Readonly<{ files: Map<string, string>; store: PhotoStore }>;

// A tiny JPEG (its first bytes are what PocketBase checks): a photo's content in the scenarios.
export const TEST_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

export type StoredRow = Record<string, unknown> & { id: string; updated: string };

// A sync server for the scenarios below: the in-memory fake (sync-engine.test.ts) or a real
// PocketBase (sync-engine.pocketbase.test.ts), empty at the start of each scenario.
export type SyncTestServer = Readonly<{
  account: Readonly<{ email: string; password: string }>;
  fetch: typeof fetch;
  // The rows stored in a collection, deleted ones included.
  rowsOf: (table: SyncedTable) => Promise<StoredRow[]>;
  serverUrl: string;
}>;

export function addRecipe(phone: Phone, title: string, ingredientNameList: string[] = []) {
  return saveRecipe(phone.db, {
    ingredientIdList: ingredientNameList.map((name) => findOrCreateIngredient(phone.db, name).id),
    instructions: '',
    season: 'both',
    title,
  });
}

// Every time the recipe was cooked on the phone, oldest first ([]: never, or no such recipe).
export function cookedDatesOf(phone: Phone, title: string) {
  const recipe = recipeOf(phone, title);
  return recipe
    ? phone.db
        .select({ cookedAt: cookedMeals.cookedAt })
        .from(cookedMeals)
        .where(eq(cookedMeals.recipeId, recipe.id))
        .orderBy(asc(cookedMeals.cookedAt))
        .all()
        .map(({ cookedAt }) => cookedAt)
    : [];
}

export function createTestPhotos(fetchFunction: typeof fetch): TestPhotos {
  const files = new Map<string, string>();
  let downloadCount = 0;
  return {
    files,
    store: {
      delete: (file) => {
        files.delete(file);
      },
      download: async (url) => {
        const response = await fetchFunction(url);
        if (!response.ok) {
          throw new Error(`Download failed: ${response.status}`);
        }
        downloadCount += 1;
        const file = ['downloaded-', String(downloadCount), '.jpg'].join('');
        files.set(file, Buffer.from(await response.arrayBuffer()).toString('base64'));
        return file;
      },
      toUpload: (file) => {
        const content = files.get(file);
        return content === undefined
          ? undefined
          : new Blob([Buffer.from(content, 'base64')], { type: 'image/jpeg' });
      },
    },
  };
}

// Two phones syncing with the same server: what the sync must do whatever the server is.
export function describeSyncScenarios(createServer: () => Promise<SyncTestServer>) {
  let server: SyncTestServer;
  let phoneA: Phone;
  let phoneB: Phone;

  beforeEach(async () => {
    server = await createServer();
    phoneA = { cursors: INITIAL_CURSORS, db: createTestConnection().db };
    phoneB = { cursors: INITIAL_CURSORS, db: createTestConnection().db };
  });

  const sync = async (phone: Phone) => {
    const { account, fetch, serverUrl } = server;
    const token = await signIn({ ...account, fetch, serverUrl });
    const api = createSyncApi({ fetch, serverUrl, token });
    phone.cursors = await synchronize(phone.db, api, phone.cursors, {
      photos: phone.photos?.store,
    });
  };
  // A, then B, then A again: both have everything.
  const syncBoth = async () => {
    await sync(phoneA);
    await sync(phoneB);
    await sync(phoneA);
  };

  it('merges the recipes of two phones, with one copy of an ingredient both have', async () => {
    addRecipe(phoneA, 'Leek soup', ['Leek', 'Potato']);
    addRecipe(phoneB, 'Leek pie', ['leek', 'Pastry']);

    await syncBoth();

    for (const phone of [phoneA, phoneB]) {
      expect(titlesOf(phone)).toStrictEqual(['Leek pie', 'Leek soup']);
      expect(ingredientNamesOf(phone)).toHaveLength(3);
      expect(
        recipeOf(phone, 'Leek pie')?.ingredientList.map(({ name }) => name.toLowerCase()),
      ).toStrictEqual(['leek', 'pastry']);
    }

    await expect(server.rowsOf('ingredients')).resolves.toHaveLength(3);
  });

  it('brings a change made on one phone to the other', async () => {
    const id = addRecipe(phoneA, 'Soup', ['Leek']);
    await syncBoth();

    saveRecipe(
      phoneA.db,
      {
        course: 'starter',
        ingredientIdList: [findOrCreateIngredient(phoneA.db, 'Carrot').id],
        instructions: 'Simmer.',
        season: 'winter',
        title: 'Carrot soup',
      },
      id,
    );
    await sync(phoneA);
    await sync(phoneB);

    expect(recipeOf(phoneB, 'Carrot soup')).toMatchObject({
      course: 'starter',
      ingredientList: [{ name: 'Carrot' }],
      instructions: 'Simmer.',
      season: 'winter',
    });
    expect(titlesOf(phoneB)).toStrictEqual(['Carrot soup']);
  });

  it('brings the quantities of a recipe to the other phone, and their changes', async () => {
    const carrotId = findOrCreateIngredient(phoneA.db, 'Carrot').id;
    const leekId = findOrCreateIngredient(phoneA.db, 'Leek').id;
    const saltId = findOrCreateIngredient(phoneA.db, 'Salt').id;
    const input = {
      ingredientIdList: [carrotId, leekId, saltId],
      instructions: '',
      season: 'both' as const,
      title: 'Soup',
    };
    const id = saveRecipe(phoneA.db, {
      ...input,
      quantities: new Map([
        [carrotId, { amount: 0.5, unit: 'kg' as const }],
        [leekId, { amount: 2 }],
      ]),
    });
    await syncBoth();

    expect(recipeOf(phoneB, 'Soup')?.ingredientList).toMatchObject([
      { name: 'Carrot', quantity: { amount: 500, unit: 'g' } },
      { name: 'Leek', quantity: { amount: 2 } },
      { name: 'Salt' },
    ]);
    expect(recipeOf(phoneB, 'Soup')?.ingredientList[2]).not.toHaveProperty('quantity');

    saveRecipe(
      phoneA.db,
      { ...input, quantities: new Map([[saltId, { amount: 1, unit: 'pinch' as const }]]) },
      id,
    );
    await sync(phoneA);
    await sync(phoneB);

    expect(recipeOf(phoneB, 'Soup')?.ingredientList.map(({ quantity }) => quantity)).toStrictEqual([
      undefined,
      undefined,
      { amount: 1, unit: 'pinch' },
    ]);
  });

  it('keeps the newest change when both phones changed the same recipe', async () => {
    addRecipe(phoneA, 'Soup');
    await syncBoth();
    const setTitle = (phone: Phone, title: string, updatedAt: number) =>
      // As the app saves a title: in lowercase.
      phone.db
        .update(recipes)
        .set({ sortKey: title.toLowerCase(), title: title.toLowerCase(), updatedAt })
        .run();
    const later = Date.now() + 60_000;
    setTitle(phoneB, 'Soup by B', later + 1000);
    setTitle(phoneA, 'Soup by A', later);

    await sync(phoneB);
    // A's change is older than the server's: kept there, and A takes B's.
    await sync(phoneA);
    await sync(phoneB);

    expect(titlesOf(phoneA)).toStrictEqual(['Soup by b']);
    expect(titlesOf(phoneB)).toStrictEqual(['Soup by b']);
  });

  it('deletes on the other phone a recipe deleted on one, then forgets the deletion', async () => {
    const id = addRecipe(phoneA, 'Soup', ['Leek']);
    addRecipe(phoneA, 'Salad');
    await syncBoth();

    deleteRecipe(phoneA.db, id);
    await sync(phoneA);
    await sync(phoneB);

    expect(titlesOf(phoneB)).toStrictEqual(['Salad']);
    // The ingredient isn't deleted with the recipe.
    // Names are saved in lowercase (and shown with a capital first letter).
    expect(ingredientNamesOf(phoneB)).toStrictEqual(['leek']);
    expect(phoneA.db.select().from(syncDeletions).all()).toStrictEqual([]);
  });

  it('deletes on the other phone an unused ingredient deleted on one', async () => {
    findOrCreateIngredient(phoneA.db, 'Basil');
    await syncBoth();

    expect(deleteIngredient(phoneA.db, findIngredientByName(phoneA.db, 'Basil')!.id)).toBe(
      'deleted',
    );

    await sync(phoneA);
    await sync(phoneB);

    expect(ingredientNamesOf(phoneB)).toStrictEqual([]);
  });

  it('keeps an ingredient deleted on one phone while a recipe on the other uses it', async () => {
    findOrCreateIngredient(phoneA.db, 'Basil');
    await syncBoth();
    deleteIngredient(phoneA.db, findIngredientByName(phoneA.db, 'Basil')!.id);
    await sync(phoneA);
    // Meanwhile, B made a recipe with it.
    addRecipe(phoneB, 'Pesto', ['Basil']);

    await sync(phoneB);
    await sync(phoneA);

    expect(recipeOf(phoneB, 'Pesto')?.ingredientList).toMatchObject([{ name: 'Basil' }]);
    expect(recipeOf(phoneA, 'Pesto')?.ingredientList).toMatchObject([{ name: 'Basil' }]);
  });

  it('pulls and pushes more rows than fit in a page', async () => {
    for (let index = 0; index < 120; index++) {
      addRecipe(phoneA, `Recipe ${String(index).padStart(3, '0')}`, [`Ingredient ${index % 60}`]);
    }

    await sync(phoneA);
    await sync(phoneB);

    expect(titlesOf(phoneB)).toHaveLength(120);
    expect(ingredientNamesOf(phoneB)).toHaveLength(60);
    expect(recipeOf(phoneB, 'Recipe 061')?.ingredientList).toMatchObject([
      { name: 'Ingredient 1' },
    ]);
  });

  it('brings the meal history to the other phone, without changing the recipe', async () => {
    const soupId = addRecipe(phoneA, 'Soup');
    // Changed a while ago: not in the same millisecond as a sync below starts.
    phoneA.db
      .update(recipes)
      .set({ updatedAt: Date.now() - 10_000 })
      .run();
    await syncBoth();
    const [recipeBefore] = await server.rowsOf('recipes');

    markCooked(phoneA.db, soupId, Date.UTC(2026, 9, 10, 19));
    markCooked(phoneA.db, soupId, Date.UTC(2026, 9, 16, 19));
    await syncBoth();

    expect(lastCookedAtOf(phoneB, 'Soup')).toBe(Date.UTC(2026, 9, 16, 19));
    await expect(server.rowsOf('cooked_meals')).resolves.toHaveLength(2);
    // Marking it cooked didn't push the recipe again: an edit made on B meanwhile is kept.
    const [recipeAfter] = await server.rowsOf('recipes');
    expect(recipeAfter?.updated).toBe(recipeBefore?.updated);
  });

  it('removes on the other phone a time cooked removed on one', async () => {
    const soupId = addRecipe(phoneA, 'Soup');
    markCooked(phoneA.db, soupId, Date.UTC(2026, 9, 10, 19));
    const lastId = markCooked(phoneA.db, soupId, Date.UTC(2026, 9, 16, 19));
    await syncBoth();

    removeCookedMeal(phoneA.db, lastId);
    await syncBoth();

    expect(lastCookedAtOf(phoneB, 'Soup')).toBe(Date.UTC(2026, 9, 10, 19));
  });

  describe('gets back the meals of a recipe deleted here and brought back by an edit on the other phone', () => {
    const cookedAt = Date.UTC(2026, 9, 16, 19);
    // R cooked on A and synced to B; then A deletes R, and B edits it after that.
    const deleteHereThenEditThere = async (isDeletionPushed: boolean) => {
      const soupId = addRecipe(phoneA, 'Soup');
      markCooked(phoneA.db, soupId, cookedAt);
      await syncBoth();
      // A later meal, pulled since: A's pull of meals is past Soup's.
      markCooked(phoneB.db, addRecipe(phoneB, 'Pie'), cookedAt + 1);
      await syncBoth();
      const later = Date.now() + 60_000;
      deleteRecipe(phoneA.db, soupId);
      phoneA.db.update(syncDeletions).set({ deletedAt: later }).run();
      if (isDeletionPushed) {
        await sync(phoneA);
      }
      phoneB.db
        .update(recipes)
        .set({ instructions: 'Simmer.', updatedAt: later + 1000 })
        .run();
      await sync(phoneB);
      await sync(phoneA);
    };

    it('before A told the server about the deletion', async () => {
      await deleteHereThenEditThere(false);

      expect(recipeOf(phoneA, 'Soup')?.instructions).toBe('Simmer.');
      expect(lastCookedAtOf(phoneA, 'Soup')).toBe(cookedAt);
    });

    it('after A told the server about the deletion', async () => {
      await deleteHereThenEditThere(true);

      expect(recipeOf(phoneA, 'Soup')?.instructions).toBe('Simmer.');
      expect(lastCookedAtOf(phoneA, 'Soup')).toBe(cookedAt);
    });
  });

  it('forgets the meals of a recipe deleted on the other phone', async () => {
    const soupId = addRecipe(phoneA, 'Soup');
    markCooked(phoneA.db, soupId, Date.UTC(2026, 9, 16, 19));
    await syncBoth();

    deleteRecipe(phoneA.db, soupId);
    await syncBoth();

    expect(titlesOf(phoneB)).toStrictEqual([]);
    expect(phoneB.db.select().from(cookedMeals).all()).toStrictEqual([]);
  });

  describe('with photos', () => {
    beforeEach(() => {
      phoneA.photos = createTestPhotos(server.fetch);
      phoneB.photos = createTestPhotos(server.fetch);
    });

    // Soup on A, with a photo taken there.
    const addSoupWithPhoto = () => {
      phoneA.photos?.files.set('taken-on-a.jpg', TEST_JPEG);
      return saveRecipe(phoneA.db, {
        ingredientIdList: [],
        instructions: '',
        photo: { file: 'taken-on-a.jpg' },
        season: 'both',
        title: 'Soup',
      });
    };

    it('brings a photo taken on one phone to the other', async () => {
      addSoupWithPhoto();

      await syncBoth();

      const photoOnB = recipeOf(phoneB, 'Soup')?.photoFile;
      expect(photoOnB && phoneB.photos?.files.get(photoOnB)).toBe(TEST_JPEG);
      const [soup] = await server.rowsOf('recipes');
      expect(soup?.photo).toMatch(/\.jpg$/);
    });

    it('removes on the other phone a photo removed on one', async () => {
      const soupId = addSoupWithPhoto();
      await syncBoth();

      saveRecipe(
        phoneA.db,
        { ingredientIdList: [], instructions: '', photo: null, season: 'both', title: 'Soup' },
        soupId,
      );
      await syncBoth();

      expect(recipeOf(phoneB, 'Soup')?.photoFile).toBeUndefined();
      const [soup] = await server.rowsOf('recipes');
      expect(soup?.photo).toBe('');
    });

    it('removes a photo along with its recipe’s new version', async () => {
      const soupId = addSoupWithPhoto();
      await syncBoth();

      saveRecipe(
        phoneA.db,
        { ingredientIdList: [], instructions: '', photo: null, season: 'both', title: 'Soup' },
        soupId,
      );
      // A pushes the recipe but not its photos (as if the sync stopped there); B pulls it.
      const photosOfA = phoneA.photos;
      phoneA.photos = undefined;
      await sync(phoneA);
      phoneA.photos = photosOfA;
      await sync(phoneB);

      expect(recipeOf(phoneB, 'Soup')?.photoFile).toBeUndefined();
    });

    it('forgets a photo whose file is gone before it was uploaded', async () => {
      addSoupWithPhoto();
      // Deleted outside the app (e.g. the app's files cleared).
      phoneA.photos?.files.clear();

      await sync(phoneA);

      // No photo any more, never uploaded: it no longer waits for (nor holds up) the photo push.
      expect(
        phoneA.db
          .select({ photoFile: recipes.photoFile, photoSynced: recipes.photoSynced })
          .from(recipes)
          .all(),
      ).toStrictEqual([{ photoFile: null, photoSynced: null }]);
    });

    it('brings a photo uploaded after its recipe reached the other phone', async () => {
      addSoupWithPhoto();
      // A pushes the recipe, not its photo yet (as if the upload failed); B gets the recipe.
      const photosOfA = phoneA.photos;
      phoneA.photos = undefined;
      await sync(phoneA);
      await sync(phoneB);
      phoneA.photos = photosOfA;

      // The upload doesn't change the recipe's version: B still gets the photo.
      await sync(phoneA);
      await sync(phoneB);

      const photoOnB = recipeOf(phoneB, 'Soup')?.photoFile;
      expect(photoOnB && phoneB.photos?.files.get(photoOnB)).toBe(TEST_JPEG);
    });

    it('brings a new photo in place of the old one', async () => {
      const soupId = addSoupWithPhoto();
      await syncBoth();
      const firstOnB = recipeOf(phoneB, 'Soup')?.photoFile;

      phoneA.photos?.files.set('second.jpg', TEST_JPEG);
      saveRecipe(
        phoneA.db,
        {
          ingredientIdList: [],
          instructions: '',
          photo: { file: 'second.jpg' },
          season: 'both',
          title: 'Soup',
        },
        soupId,
      );
      await syncBoth();

      const secondOnB = recipeOf(phoneB, 'Soup')?.photoFile;
      expect(secondOnB).not.toBe(firstOnB);
      // The old photo's file is deleted once the new one is there.
      expect([...(phoneB.photos?.files.keys() ?? [])]).toStrictEqual([secondOnB]);
    });
  });

  it('only sends the rows changed since the last sync', async () => {
    addRecipe(phoneA, 'Soup');
    // Changed a while ago: not in the same millisecond as the sync below starts.
    phoneA.db
      .update(recipes)
      .set({ updatedAt: Date.now() - 10_000 })
      .run();
    await sync(phoneA);
    const [before] = await server.rowsOf('recipes');

    await sync(phoneA);

    const [after] = await server.rowsOf('recipes');
    expect(after?.updated).toBe(before?.updated);
  });
}

// When the recipe was last cooked on the phone (undefined: never, or no such recipe).
export function lastCookedAtOf(phone: Phone, title: string) {
  const recipe = recipeOf(phone, title);
  return recipe && getLastCookedMeal(phone.db, recipe.id)?.cookedAt;
}

export function recipeOf(phone: Phone, title: string) {
  const row = phone.db
    .select({ id: recipes.id })
    .from(recipes)
    // Saved in lowercase.
    .where(eq(recipes.title, title.toLowerCase()))
    .get();
  return row && getRecipe(phone.db, row.id);
}

export function titlesOf(phone: Phone) {
  return (
    phone.db
      .select({ title: recipes.title })
      .from(recipes)
      .orderBy(asc(recipes.sortKey))
      .all()
      // As shown: titles are saved in lowercase.
      .map(({ title }) => toDisplayName(title))
  );
}

function ingredientNamesOf(phone: Phone) {
  return phone.db
    .select({ name: ingredients.name })
    .from(ingredients)
    .orderBy(asc(ingredients.sortKey))
    .all()
    .map(({ name }) => name);
}
