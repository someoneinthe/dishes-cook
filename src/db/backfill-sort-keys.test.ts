import { eq } from 'drizzle-orm';
import { firstIngredientPage, firstRecipePage } from '@/test/queries';
import { createTestConnection } from '@/test/test-database';
import { backfillSortKeys } from './backfill-sort-keys';
import { ingredients, recipes } from './schema';

describe('backfillSortKeys', () => {
  it('fills the sort keys of rows created before the column existed', () => {
    const { db } = createTestConnection();
    db.insert(ingredients).values({ name: 'Échalote', nameKey: 'échalote' }).run();
    db.insert(recipes).values({ title: 'Été salad' }).run();

    backfillSortKeys(db);

    expect(firstIngredientPage(db)).toMatchObject([{ name: 'Échalote', sortKey: 'echalote' }]);
    expect(firstRecipePage(db)).toMatchObject([{ sortKey: 'ete salad', title: 'Été salad' }]);
  });

  it('leaves rows that already have a key untouched', () => {
    const { db } = createTestConnection();
    db.insert(ingredients).values({ name: 'Leek', nameKey: 'leek', sortKey: 'custom' }).run();

    backfillSortKeys(db);

    expect(
      db
        .select({ sortKey: ingredients.sortKey })
        .from(ingredients)
        .where(eq(ingredients.nameKey, 'leek'))
        .get(),
    ).toStrictEqual({ sortKey: 'custom' });
  });
});
