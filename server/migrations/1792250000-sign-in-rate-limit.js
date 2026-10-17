/// <reference path="../pb_data/types.d.ts" />
/* global migrate */
// PocketBase migration: limits password sign-ins (the app's accounts and the admin's), so they can't
// be guessed without limit when the server is reachable from the internet. PocketBase's rate
// limiter is off by default.
// - Only sign-ins (`*:auth`): a sync renews its token (auth-refresh, not counted) and sends up to 50
//   rows at once, which PocketBase's own general and create limits would refuse in a first sync.
// - No trusted proxy header: behind the reverse proxy, every client shares the proxy's address, so
//   the whole server takes a few sign-ins a minute (phones already signed in aren't affected);
//   without a proxy, no header can fake a client's address to get around the limit.

// Sign-ins per minute.
const SIGN_IN_LIMIT = { audience: '', duration: 60, label: '*:auth', maxRequests: 5 };

migrate(
  (app) => {
    const settings = app.settings();
    settings.rateLimits.enabled = true;
    settings.rateLimits.rules = [SIGN_IN_LIMIT];
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.rateLimits.enabled = false;
    settings.rateLimits.rules = settings.rateLimits.rules.filter(
      (rule) => rule.label !== SIGN_IN_LIMIT.label,
    );
    app.save(settings);
  },
);
