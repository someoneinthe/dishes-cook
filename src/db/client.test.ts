import { openDatabaseSync } from 'expo-sqlite';
import { openAppConnection } from './client';

jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn() }));
jest.mock('drizzle-orm/expo-sqlite', () => ({ drizzle: jest.fn(() => ({})) }));

describe('openAppConnection', () => {
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

    expect(() => openAppConnection()).not.toThrow();
    expect(execSync).toHaveBeenNthCalledWith(1, 'PRAGMA foreign_keys = ON;');
    expect(execSync).toHaveBeenNthCalledWith(2, 'PRAGMA journal_mode = WAL;');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
