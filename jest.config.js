/**
@type {import('jest').Config}
*/
module.exports = {
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**', '!**/*.d.ts'],
  // Same alias as tsconfig.json (`@/assets/*`), resolved before jest-expo's `@/*` -> src/ mapping.
  moduleNameMapper: { '^@/assets/(.*)$': '<rootDir>/assets/$1' },
  preset: 'jest-expo',
  // Unistyles: native runtime mocked, then the app's themes registered (StyleSheet.configure).
  setupFiles: ['react-native-unistyles/mocks', '<rootDir>/src/theme/unistyles.ts'],
};
