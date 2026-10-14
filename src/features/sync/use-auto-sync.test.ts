import { act, cleanup, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { DatabaseConnection } from '@/db/types';
import { saveRecipe } from '@/features/recipes/db/recipe-queries';
import { createFakeSyncServer } from '@/test/fake-sync-server';
import { createDataWrapper, createTestConnection } from '@/test/test-database';
import * as syncStore from './sync-store';
import { useAutoSync, WRITE_SYNC_DELAY_MS } from './use-auto-sync';

const ACCOUNT = { email: 'home@example.org', password: 'test-password' };

describe('useAutoSync', () => {
  let connection: DatabaseConnection;
  let syncSpy: jest.SpyInstance;

  beforeEach(() => {
    connection = createTestConnection();
    jest.spyOn(globalThis, 'fetch').mockImplementation(createFakeSyncServer(ACCOUNT).fetch);
  });

  afterEach(async () => {
    await cleanup();
    await syncStore.disconnect();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const startConnected = async () => {
    await syncStore.connect(connection.db, { ...ACCOUNT, serverUrl: 'https://sync.example.org' });
    syncSpy = jest.spyOn(syncStore, 'syncNow');
    jest.useFakeTimers();
    await renderHook(() => useAutoSync(), { wrapper: createDataWrapper(connection) });
  };
  const addRecipe = async (title: string) => {
    await act(() => {
      saveRecipe(connection.db, { ingredientIdList: [], instructions: '', season: 'both', title });
    });
  };

  it('does nothing while not connected', async () => {
    syncSpy = jest.spyOn(syncStore, 'syncNow');
    await renderHook(() => useAutoSync(), { wrapper: createDataWrapper(connection) });
    await addRecipe('Soup');

    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('syncs when the app starts', async () => {
    await startConnected();

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('syncs once, a few seconds after a burst of changes', async () => {
    await startConnected();
    await act(() => jest.runOnlyPendingTimersAsync());
    syncSpy.mockClear();

    await addRecipe('Soup');
    await act(() => jest.advanceTimersByTimeAsync(WRITE_SYNC_DELAY_MS / 2));
    await addRecipe('Salad');

    expect(syncSpy).not.toHaveBeenCalled();

    await act(() => jest.advanceTimersByTimeAsync(WRITE_SYNC_DELAY_MS));

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('syncs when the app comes back to the foreground', async () => {
    const listenerList: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
      listenerList.push(listener as (state: string) => void);
      return { remove: jest.fn() };
    });
    await startConnected();
    syncSpy.mockClear();

    await act(() => {
      for (const listener of listenerList) {
        listener('active');
      }
    });

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });
});
