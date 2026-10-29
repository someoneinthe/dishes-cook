/// <reference path="../pb_data/types.d.ts" />
/* global routerUse */
// PocketBase hook: the web app, which PocketBase serves from `pb_public/` (see docs/sync.md › Web
// app). Copy it into `pb_hooks/` next to the PocketBase executable (`npm run server:deploy` does).

// Its database runs SQLite in a web worker, whose synchronous calls need SharedArrayBuffer: browsers
// only give it to a cross-origin isolated page, which these headers ask for. `require-corp`, not
// `credentialless`: Safari only knows the first, and the app loads nothing from other sites. Not on the API (the
// apps' requests) nor on PocketBase's admin UI, which need neither.
routerUse((event) => {
  const path = event.request.url.path;
  if (!path.startsWith('/api/') && !path.startsWith('/_/')) {
    event.response.header().set('Cross-Origin-Embedder-Policy', 'require-corp');
    event.response.header().set('Cross-Origin-Opener-Policy', 'same-origin');
  }
  return event.next();
});
