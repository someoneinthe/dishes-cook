import { createChangeNotifier } from './change-notifier';

describe('createChangeNotifier', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

  it('notifies once after a batch of writes, not after reads', async () => {
    const { logger, subscribe } = createChangeNotifier();
    const listener = jest.fn();
    subscribe(listener);

    logger.logQuery('select "id" from "recipes"');
    await flushMicrotasks();

    expect(listener).not.toHaveBeenCalled();

    logger.logQuery('begin');
    logger.logQuery('insert into "recipes" ("title") values (?)');
    logger.logQuery('delete from "recipe_ingredients" where "recipe_id" = ?');
    logger.logQuery('UPDATE "recipes" SET "title" = ?');
    logger.logQuery('commit');

    expect(listener).not.toHaveBeenCalled();

    await flushMicrotasks();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('still notifies the other listeners when one throws', async () => {
    const { logger, subscribe } = createChangeNotifier();
    const errorSpy = jest.spyOn(console, 'error').mockReturnValue(undefined);
    const listener = jest.fn();
    subscribe(() => {
      throw new Error('broken screen');
    });
    subscribe(listener);

    logger.logQuery('insert into "ingredients" ("name") values (?)');
    await flushMicrotasks();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("holds a sync's writes and tells them once, as the sync's, apart from the app's", async () => {
    const { holdSyncChanges, logger, releaseSyncChanges, subscribe } = createChangeNotifier();
    const listener = jest.fn();
    subscribe(listener);

    holdSyncChanges(() => {
      logger.logQuery('insert into "recipes" ("title") values (?)');
    });
    holdSyncChanges(() => {
      logger.logQuery('update "recipes" set "title" = ?');
    });
    logger.logQuery('insert into "ingredients" ("name") values (?)');
    await flushMicrotasks();

    expect(listener.mock.calls).toStrictEqual([['app']]);

    releaseSyncChanges();
    releaseSyncChanges();

    expect(listener.mock.calls).toStrictEqual([['app'], ['sync']]);
  });

  it('stops notifying after unsubscribe', async () => {
    const { logger, subscribe } = createChangeNotifier();
    const listener = jest.fn();
    const unsubscribe = subscribe(listener);

    unsubscribe();
    logger.logQuery('insert into "ingredients" ("name") values (?)');
    await flushMicrotasks();

    expect(listener).not.toHaveBeenCalled();
  });
});
