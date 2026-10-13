import { createChangeNotifier } from './change-notifier';

describe('createChangeNotifier', () => {
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
