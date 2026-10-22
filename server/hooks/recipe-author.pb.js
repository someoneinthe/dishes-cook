/// <reference path="../pb_data/types.d.ts" />
/* global onRecordCreateRequest, onRecordUpdateRequest */
// PocketBase hook: a recipe's author (`created_by`, server/migrations/1792700000-recipe-author.js)
// is the account that created it, and never changes (see docs/sync.md › How it works). The app never
// sends it; whatever a request sends is replaced. Copy it into `pb_hooks/` next to the PocketBase
// executable (`npm run server:deploy` does).

// Created by a phone's account: that account. By the admin (a superuser, in the admin UI): what the
// admin chose.
onRecordCreateRequest((event) => {
  if (event.auth && event.auth.collection().name === 'users') {
    event.record.set('created_by', event.auth.id);
  }
  event.next();
}, 'recipes');

// Updated by a phone: the author stays (the admin may change it).
onRecordUpdateRequest((event) => {
  if (event.auth && event.auth.collection().name === 'users') {
    event.record.set('created_by', event.record.original().get('created_by'));
  }
  event.next();
}, 'recipes');
