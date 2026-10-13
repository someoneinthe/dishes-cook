import type { DatabaseChangeEvent } from 'expo-sqlite';
import { addDatabaseChangeListener, openDatabaseSync } from 'expo-sqlite';
import { createAppConnection, openAppDatabase } from './client';

jest.mock('expo-sqlite', () => ({
  addDatabaseChangeListener: jest.fn(),
  openDatabaseSync: jest.fn(),
}));
jest.mock('drizzle-orm/expo-sqlite', () => ({ drizzle: jest.fn() }));

const remove = jest.fn();

describe('client', () => {
  describe('openAppDatabase', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('enables foreign keys even when WAL cannot be enabled', () => {
      // First call: foreign keys; second call: WAL, which fails.
      const execSync = jest
        .fn()
        .mockReturnValueOnce(undefined)
        .mockImplementationOnce(() => {
          throw new Error('SQLITE_BUSY');
        });
      jest
        .mocked(openDatabaseSync)
        .mockReturnValue({ execSync } as unknown as ReturnType<typeof openDatabaseSync>);
      const warnSpy = jest.spyOn(console, 'warn').mockReturnValue(undefined);

      expect(() => openAppDatabase()).not.toThrow();
      expect(execSync).toHaveBeenNthCalledWith(1, 'PRAGMA foreign_keys = ON;');
      expect(execSync).toHaveBeenNthCalledWith(2, 'PRAGMA journal_mode = WAL;');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('createAppConnection', () => {
    let emit: (tableName: string) => void;

    beforeEach(() => {
      jest.useFakeTimers();
      jest.mocked(addDatabaseChangeListener).mockImplementation((listener) => {
        emit = (tableName) => listener({ tableName } as DatabaseChangeEvent);
        return { remove };
      });
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllMocks();
    });

    const subscribe = () => {
      const listener = jest.fn();
      const database = {} as ReturnType<typeof openAppDatabase>;
      const unsubscribe = createAppConnection(database).subscribe(listener);
      return { listener, unsubscribe };
    };

    it('reports each changed table once per tick, whatever the number of modified rows', () => {
      const { listener } = subscribe();

      emit('recipes');
      emit('recipe_ingredients');
      emit('recipe_ingredients');
      emit('recipe_ingredients');

      expect(listener).not.toHaveBeenCalled();

      jest.runAllTimers();

      expect(listener.mock.calls).toStrictEqual([['recipes'], ['recipe_ingredients']]);

      emit('recipes');
      jest.runAllTimers();

      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('stops listening and drops pending notifications on unsubscribe', () => {
      const { listener, unsubscribe } = subscribe();

      emit('recipes');
      unsubscribe();
      jest.runAllTimers();

      expect(remove).toHaveBeenCalledTimes(1);
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
