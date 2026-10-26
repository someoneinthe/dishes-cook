import { asc, eq } from 'drizzle-orm';
import type { SyncedTable } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { SyncCursors } from '@/features/sync/sync-engine';
import type { PhotoStore } from '@/features/sync/sync-photos';
import { accounts, cookedMeals, ingredients, recipes, syncDeletions } from '@/db/schema';
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
import { toIngredientSyncId } from '@/lib/sync-id';
import { toDisplayName, toNameKey, toSortKey } from '@/lib/text';
import { createTestConnection } from './test-database';

// A phone; `photos` keeps its recipe photos' files when the scenario syncs them.
export type Phone = { cursors: SyncCursors; db: AppDatabase; photos?: TestPhotos };

// A phone's photo files, in memory (base64 contents by file name), as the sync reads and writes them.
type TestPhotos = Readonly<{ files: Map<string, string>; store: PhotoStore }>;

// A tiny JPEG (its first bytes are what PocketBase checks): a photo's content in the scenarios.
const TEST_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

export type StoredRow = Record<string, unknown> & { id: string; updated: string };

// A sync server for the scenarios below: the in-memory fake (sync-engine.test.ts) or a real
// PocketBase (sync-engine.pocketbase.test.ts), empty at the start of each scenario.
export type SyncTestServer = Readonly<{
  account: Readonly<{ email: string; password: string }>;
  // Adds another account with this name (as the admin does); resolves with its id.
  addAccount: (name: string) => Promise<string>;
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

// Who added the recipe (recipes.createdBy): null while it isn't on the server.
export function authorOf(phone: Phone, title: string) {
  return phone.db
    .select({ createdBy: recipes.createdBy })
    .from(recipes)
    .where(eq(recipes.title, title.toLowerCase()))
    .get()?.createdBy;
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

function createTestPhotos(fetchFunction: typeof fetch): TestPhotos {
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
    const { token } = await signIn({ ...account, fetch, serverUrl });
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

  // A phone with an ingredient of the same name under another sync id (added with an older app, or
  // written straight into its database): it keeps its own, and the recipes it pulls link it.
  it('keeps an ingredient a phone has under another id in the recipes it pulls, without sending them back', async () => {
    phoneB.db
      .insert(ingredients)
      .values({
        name: 'œufs',
        nameKey: 'œufs',
        sortKey: toSortKey('œufs'),
        syncId: 'b0000000000000e',
      })
      .run();
    addRecipe(phoneA, 'Quiche', ['Œufs', 'Lait']);
    await sync(phoneA);

    await sync(phoneB);

    expect(
      recipeOf(phoneB, 'Quiche')?.ingredientList.map(({ name }) => name.toLowerCase()),
    ).toStrictEqual(['lait', 'œufs']);
    // The server's recipe still has phone A's eggs: phone B sent nothing back.
    const [quiche] = await server.rowsOf('recipes');
    expect(quiche?.ingredients).toContain(toIngredientSyncId(toNameKey('œufs')));

    await sync(phoneA);

    expect(recipeOf(phoneA, 'Quiche')?.ingredientList).toHaveLength(2);
  });

  it('never sends back a row it just pulled', async () => {
    addRecipe(phoneA, 'Soup', ['Leek']);
    await sync(phoneA);
    const beforeList = await server.rowsOf('recipes');

    await sync(phoneB);
    await sync(phoneB);

    await expect(server.rowsOf('recipes')).resolves.toStrictEqual(beforeList);
  });

  it('deletes an ingredient deleted with the recipes using it, rather than sending it back', async () => {
    const omeletteId = addRecipe(phoneA, 'Omelette', ['Œufs']);
    await syncBoth();
    deleteRecipe(phoneA.db, omeletteId);
    deleteIngredient(phoneA.db, findIngredientByName(phoneA.db, 'Œufs')!.id);
    await sync(phoneA);

    // Phone B pulls the ingredient's deletion while its omelette, deleted by the same sync, still
    // uses it.
    await sync(phoneB);

    expect(titlesOf(phoneB)).toStrictEqual([]);
    expect(ingredientNamesOf(phoneB)).toStrictEqual([]);
    const [eggs] = await server.rowsOf('ingredients');
    expect(eggs?.deleted).toBeGreaterThan(0);
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

  it('gives a recipe the account that added it as author, kept through edits on any phone', async () => {
    addRecipe(phoneA, 'Soup');
    // Not on the server yet: no author (the phone's own).
    expect(authorOf(phoneA, 'Soup')).toBeNull();
    await syncBoth();
    const idOnB = recipeOf(phoneB, 'Soup')?.id;
    saveRecipe(
      phoneB.db,
      { ingredientIdList: [], instructions: '', season: 'both', title: 'Leek soup' },
      idOnB,
    );

    await sync(phoneB);
    await sync(phoneA);

    const { account, fetch, serverUrl } = server;
    const { accountId } = await signIn({ ...account, fetch, serverUrl });
    for (const phone of [phoneA, phoneB]) {
      expect(authorOf(phone, 'Leek soup')).toBe(accountId);
    }
    await expect(server.rowsOf('recipes')).resolves.toMatchObject([{ created_by: accountId }]);
  });

  it('names who added a recipe with the names of the server’s accounts', async () => {
    const aliceId = await server.addAccount('Alice');
    addRecipe(phoneA, 'Soup');

    await syncBoth();

    const { account, fetch, serverUrl } = server;
    const { accountId } = await signIn({ ...account, fetch, serverUrl });
    expect(phoneB.db.select().from(accounts).orderBy(asc(accounts.id)).all()).toStrictEqual(
      [
        { id: accountId, name: '' },
        { id: aliceId, name: 'Alice' },
      ].toSorted((a, b) => a.id.localeCompare(b.id)),
    );
    expect(recipeOf(phoneB, 'Soup')?.addedBy).toStrictEqual({ accountId });
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

    it('removes the old photo when the new one’s file is gone before it was uploaded', async () => {
      const soupId = addSoupWithPhoto();
      await syncBoth();
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
      phoneA.photos?.files.delete('second.jpg');

      await syncBoth();

      expect(recipeOf(phoneA, 'Soup')?.photoFile).toBeUndefined();
      expect(recipeOf(phoneB, 'Soup')?.photoFile).toBeUndefined();
      const [soup] = await server.rowsOf('recipes');
      expect(soup?.photo).toBe('');
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

  it('brings a drink to the other phone as a drink', async () => {
    saveRecipe(phoneA.db, {
      ingredientIdList: [],
      instructions: '',
      kind: 'drink',
      season: 'summer',
      title: 'Mojito',
    });
    addRecipe(phoneA, 'Soup');

    await syncBoth();

    expect(recipeOf(phoneB, 'Mojito')?.kind).toBe('drink');
    expect(recipeOf(phoneB, 'Soup')?.kind).toBe('dish');
    const rowList = await server.rowsOf('recipes');
    expect(new Set(rowList.map(({ kind }) => kind))).toStrictEqual(new Set(['dish', 'drink']));
  });

  it('brings a drink’s maturation time to the other phone, in months as typed', async () => {
    saveRecipe(phoneA.db, {
      ingredientIdList: [],
      instructions: '',
      kind: 'drink',
      maturationMonths: 1.5,
      season: 'both',
      title: 'Limoncello',
    });
    addRecipe(phoneA, 'Soup');

    await syncBoth();

    expect(recipeOf(phoneB, 'Limoncello')?.maturationMonths).toBe(1.5);
    expect(recipeOf(phoneB, 'Soup')?.maturationMonths).toBeUndefined();
    const rowList = await server.rowsOf('recipes');
    expect(new Set(rowList.map((row) => row.maturation_months))).toStrictEqual(new Set([0, 1.5]));
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
