const expoPreset = require('jest-expo/jest-preset');

const JS_TRANSFORM = String.raw`\.[jt]sx?$`;
const [babelJest, babelOptions] = expoPreset.transform[JS_TRANSFORM];

/**
@type {import('jest').Config}
*/
module.exports = {
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**', '!src/test/**', '!**/*.d.ts'],
  // Same alias as tsconfig.json (`@/assets/*`), resolved before jest-expo's `@/*` -> src/ mapping.
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    // jest-cucumber -> @cucumber/messages -> uuid: jest-expo picks uuid's ESM browser build; use CommonJS.
    '^uuid$': require.resolve('uuid', { paths: [require.resolve('@cucumber/messages')] }),
  },
  preset: 'jest-expo',
  // Unistyles: native runtime mocked, then the app's themes registered (StyleSheet.configure).
  setupFiles: ['react-native-unistyles/mocks', '<rootDir>/src/theme/unistyles.ts'],
  // Module mocks shared by every test (header buttons of screens).
  setupFilesAfterEnv: ['<rootDir>/src/test/setup-after-environment.ts'],
  // Sync tests against a real PocketBase only run with one: `npm run test:pocketbase`.
  testPathIgnorePatterns: process.env.POCKETBASE_URL
    ? ['/node_modules/']
    : ['/node_modules/', String.raw`\.pocketbase\.test\.ts$`],
  // Compile like the app: Metro enables the React Compiler (app.config.ts), jest-expo doesn't.
  // Without it, tests miss memoization bugs (a live query once returned stale data on device only).
  transform: {
    ...expoPreset.transform,
    [JS_TRANSFORM]: [
      babelJest,
      {
        ...babelOptions,
        caller: { ...babelOptions.caller, platform: 'android', supportsReactCompiler: true },
      },
    ],
  },
  // marked ships ES modules only: compile it like the app's code (Metro does).
  transformIgnorePatterns: withTransformedPackages(expoPreset.transformIgnorePatterns, ['marked']),
};

// Adds packages to the preset's "node_modules except …" pattern; fails loudly if it changes shape.
function withTransformedPackages(patternList, packageList) {
  const EXCEPT = '(?!(';
  if (patternList.every((pattern) => !pattern.includes(EXCEPT))) {
    throw new Error('jest-expo transformIgnorePatterns changed: update jest.config.js');
  }
  return patternList.map((pattern) =>
    pattern.replace(EXCEPT, () => `${EXCEPT}${packageList.join('|')}|`),
  );
}
