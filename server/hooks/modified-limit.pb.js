/// <reference path="../pb_data/types.d.ts" />
/* global BadRequestError, onRecordCreateRequest, onRecordUpdateRequest */
// PocketBase hook: a synced row's version (`modified`, the phone's clock in ms) can't be more than a
// day ahead of the server's clock (see docs/sync.md › How it works). The update rule refuses any
// change older than the stored version, so a row saved with a far-future one (by mistake, or on
// purpose) could never be changed or deleted again. A phone whose clock is a day ahead gets an
// error until it's set right. Copy it into `pb_hooks/` next to the PocketBase executable
// (`npm run server:deploy` does).

function refuseFutureVersion(event) {
  // Inside the handler: PocketBase runs each handler in its own context, without this file's scope.
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  if (event.record.getInt('modified') > Date.now() + ONE_DAY_MS) {
    throw new BadRequestError('modified is more than a day ahead of the server clock');
  }
  event.next();
}

onRecordCreateRequest(refuseFutureVersion, 'ingredients', 'recipes', 'cooked_meals');
onRecordUpdateRequest(refuseFutureVersion, 'ingredients', 'recipes', 'cooked_meals');
