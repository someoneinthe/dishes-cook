/// <reference path="../pb_data/types.d.ts" />
/* global migrate */
// PocketBase migration: limits sign-ins (the app's accounts and the admin's), so passwords can't be
// guessed without limit when the server is reachable from the internet. PocketBase's rate limiter
// is off by default.
// - Sign-ins only (`*:auth`: passwords, and one-time codes or OAuth2 if ever enabled; each auth
//   collection has its own count): a sync renews its token (auth-refresh, not counted) and sends
//   up to 50 rows at once, which PocketBase's general and create limits would refuse in a first
//   sync. A server whose limiter was already on keeps its other rules.
// - No trusted proxy header: behind the reverse proxy, every client shares the proxy's address, so
//   a few sign-ins a minute for the whole server (phones already signed in aren't affected);
//   without a proxy, no header can fake a client's address to get around the limit.

// Sign-ins per minute.
const SIGN_IN_LIMIT = { audience: '', duration: 60, label: '*:auth', maxRequests: 5 };

migrate(
  (app) => {
    const settings = app.settings();
    // Off, the stored rules are PocketBase's defaults, which would refuse a first sync: not kept.
    const keptRuleList = settings.rateLimits.enabled
      ? settings.rateLimits.rules.filter((rule) => rule.label !== SIGN_IN_LIMIT.label)
      : [];
    settings.rateLimits.enabled = true;
    settings.rateLimits.rules = [...keptRuleList, SIGN_IN_LIMIT];
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.rateLimits.rules = settings.rateLimits.rules.filter(
      (rule) => rule.label !== SIGN_IN_LIMIT.label,
    );
    settings.rateLimits.enabled = settings.rateLimits.rules.length > 0;
    app.save(settings);
  },
);
