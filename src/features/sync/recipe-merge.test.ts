import type { SyncedContent } from './recipe-merge';
import { isSameContent, mergeContent, parseSyncedContent } from './recipe-merge';

const BASE: SyncedContent = {
  cookMinutes: 45,
  course: 'main',
  ingredients: { leek: { amount: 2 }, potato: null },
  instructions: 'Cook.',
  kind: 'dish',
  maturationMonths: null,
  prepMinutes: null,
  season: 'both',
  title: 'soup',
};

describe('recipe-merge', () => {
  describe('mergeContent', () => {
    it('keeps the changes of each side, field by field', () => {
      const local = { ...BASE, title: 'leek soup' };
      const remote = { ...BASE, cookMinutes: 30, season: 'winter' as const };

      expect(mergeContent(BASE, local, remote, false)).toStrictEqual({
        ...BASE,
        cookMinutes: 30,
        season: 'winter',
        title: 'leek soup',
      });
    });

    it('gives a field both sides changed to the newest', () => {
      const local = { ...BASE, instructions: 'Here.' };
      const remote = { ...BASE, instructions: 'There.' };

      expect(mergeContent(BASE, local, remote, true).instructions).toBe('Here.');
      expect(mergeContent(BASE, local, remote, false).instructions).toBe('There.');
    });

    it('merges ingredients one by one: added, removed, quantity changed', () => {
      const local = {
        ...BASE,
        ingredients: { carrot: null, leek: { amount: 3 }, potato: null },
      };
      const remote = {
        ...BASE,
        ingredients: { leek: { amount: 2 }, salt: { amount: 1, unit: 'pinch' as const } },
      };

      expect(mergeContent(BASE, local, remote, false).ingredients).toStrictEqual({
        carrot: null,
        leek: { amount: 3 },
        salt: { amount: 1, unit: 'pinch' },
      });
    });

    it('gives an ingredient both sides changed to the newest, even a removal', () => {
      const local = { ...BASE, ingredients: { potato: null } };
      const remote = { ...BASE, ingredients: { leek: { amount: 5 }, potato: null } };

      expect(mergeContent(BASE, local, remote, true).ingredients).toStrictEqual({ potato: null });
      expect(mergeContent(BASE, local, remote, false).ingredients).toStrictEqual({
        leek: { amount: 5 },
        potato: null,
      });
    });
  });

  describe('isSameContent', () => {
    it('compares every field and ingredient, in any order', () => {
      const reordered = { ...BASE, ingredients: { leek: { amount: 2 }, potato: null } };

      expect(isSameContent(BASE, reordered)).toBe(true);
      expect(isSameContent(BASE, { ...BASE, title: 'stew' })).toBe(false);
      expect(isSameContent(BASE, { ...BASE, ingredients: { leek: { amount: 2 } } })).toBe(false);
      expect(isSameContent(BASE, { ...BASE, ingredients: { leek: null, potato: null } })).toBe(
        false,
      );
      expect(
        isSameContent(BASE, { ...BASE, ingredients: { carrot: null, leek: { amount: 2 } } }),
      ).toBe(false);
    });
  });

  describe('parseSyncedContent', () => {
    it('reads back a stored content, quantities normalized', () => {
      const stored = JSON.stringify({
        ...BASE,
        ingredients: { leek: { amount: 2, unit: null }, potato: null, salt: { amount: -1 } },
      });

      expect(parseSyncedContent(stored)).toStrictEqual({
        ...BASE,
        ingredients: { leek: { amount: 2 }, potato: null, salt: null },
      });
    });

    it('reads nothing from a missing or unusable content', () => {
      expect(parseSyncedContent(null)).toBeUndefined();
      expect(parseSyncedContent('{')).toBeUndefined();
      expect(parseSyncedContent('"soup"')).toBeUndefined();
      expect(parseSyncedContent(JSON.stringify({ ...BASE, course: 'brunch' }))).toBeUndefined();
      expect(parseSyncedContent(JSON.stringify({ ...BASE, ingredients: null }))).toBeUndefined();
    });

    it('reads missing times as none', () => {
      const { cookMinutes, ...withoutTimes } = BASE;

      expect(cookMinutes).toBe(45);
      expect(parseSyncedContent(JSON.stringify(withoutTimes))?.cookMinutes).toBeNull();
    });
  });
});
