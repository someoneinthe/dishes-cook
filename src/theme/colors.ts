// Raw values live in palette.json so app.config.ts (native splash background) can read them too:
// Expo's config loader resolves JSON imports but not TypeScript ones.
export { default as colors } from './palette.json';
