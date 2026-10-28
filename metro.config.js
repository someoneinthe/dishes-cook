const { getDefaultConfig } = require('expo/metro-config');
// https://docs.expo.dev/guides/customizing-metro/
const { ServerResponse } = require('node:http');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are .sql files bundled into the app (inlined by babel-plugin-inline-import).
config.resolver.sourceExts.push('sql');
// The web: expo-sqlite runs SQLite as WebAssembly (https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/).
config.resolver.assetExts.push('wasm');

// The web dev server: expo-sqlite's synchronous calls need SharedArrayBuffer, which browsers only
// give a cross-origin isolated page. Expo's dev server serves the page before Metro's middleware
// (enhanceMiddleware never sees it) and has no option for its headers in a single-page app, so
// they're added to every response of this process. The sync server sends the same ones in
// production (server/hooks/web-app.pb.js); the phone's dev server ignores them.
const { writeHead } = ServerResponse.prototype;
/* eslint-disable unicorn/no-this-outside-of-class -- a method of ServerResponse, patched */
ServerResponse.prototype.writeHead = function writeHeadIsolated(...argumentList) {
  if (!this.headersSent) {
    this.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    this.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
  return writeHead.apply(this, argumentList);
};
/* eslint-enable unicorn/no-this-outside-of-class */

module.exports = config;
