/// <reference path="../pb_data/types.d.ts" />
/* global migrate */
// PocketBase migration: limits sign-ins (the app's accounts and the admin's), so passwords can't be
// guessed without limit when the server is reachable from the internet. PocketBase's rate limiter
// is off by default.
// - Sign-ins only (`*:auth`: passwords, and one-time codes or OAuth2 if ever enabled; each auth
//   collection has its own count): a sync renews its token (auth-refresh, not counted) and sends
//   up to 50 rows at once, which PocketBase's general and create limits would refuse in a first
//   sync. A server whose limiter was already on keeps its rules, its own sign-in rule included.
// - No trusted proxy header: behind the reverse proxy, every client shares the proxy's address, so
//   a few sign-ins a minute for the whole server (phones already signed in aren't affected);
//   without a proxy, no header can fake a client's address to get around the limit.

// Sign-ins per minute.
const SIGN_IN_LIMIT = { audience: '', duration: 60, label: '*:auth', maxRequests: 5 };

// This migration's own rule, not an admin's (same label, other numbers).
const isSignInLimit = (rule) =>
  rule.label === SIGN_IN_LIMIT.label &&
  rule.audience === SIGN_IN_LIMIT.audience &&
  rule.duration === SIGN_IN_LIMIT.duration &&
  rule.maxRequests === SIGN_IN_LIMIT.maxRequests;

migrate(
  (app) => {
    const settings = app.settings();
    // Off, the stored rules were never in force (PocketBase's defaults would refuse a first sync):
    // not turned on. On, they're kept, and so is an admin's own sign-in rule.
    const ruleList = settings.rateLimits.enabled ? settings.rateLimits.rules : [];
    const hasSignInRule = ruleList.some((rule) => rule.label === SIGN_IN_LIMIT.label);
    settings.rateLimits.enabled = true;
    settings.rateLimits.rules = hasSignInRule ? ruleList : [...ruleList, SIGN_IN_LIMIT];
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.rateLimits.rules = settings.rateLimits.rules.filter((rule) => !isSignInLimit(rule));
    settings.rateLimits.enabled = settings.rateLimits.rules.length > 0;
    app.save(settings);
  },
);
