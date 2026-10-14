import { isSyncId, toIngredientSyncId } from './sync-id';

describe('sync ids', () => {
  describe('toIngredientSyncId', () => {
    it('gives the same id to the same name on every call', () => {
      expect(toIngredientSyncId('carrot')).toBe(toIngredientSyncId('carrot'));
    });

    it('gives different names different ids', () => {
      const idSet = new Set(
        ['carrot', 'carrots', 'pâte', 'pâté', 'œuf', '', 'a'.repeat(200)].map((name) =>
          toIngredientSyncId(name),
        ),
      );

      expect(idSet.size).toBe(7);
    });

    it.each([['carrot'], [''], ['crème fraîche'], ['🥕']])(
      'makes an id in the server format for %p',
      (name) => {
        expect(isSyncId(toIngredientSyncId(name))).toBe(true);
      },
    );
  });

  describe('isSyncId', () => {
    it.each([['0123456789abcdef'], ['0123456789ABCDE'], ['0123456789abcd'], [12], [undefined]])(
      'refuses %p',
      (value) => {
        expect(isSyncId(value)).toBe(false);
      },
    );

    it('accepts 15 characters of 0-9 and a-f', () => {
      expect(isSyncId('0123456789abcde')).toBe(true);
    });
  });
});
