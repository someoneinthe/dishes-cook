// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are .sql files bundled into the app (inlined by babel-plugin-inline-import).
config.resolver.sourceExts.push('sql');

module.exports = config;
