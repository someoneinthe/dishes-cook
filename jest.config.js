/**
@type {import('jest').Config}
*/
module.exports = {
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**', '!**/*.d.ts'],
  // Same alias as tsconfig.json (`@/assets/*`), resolved before jest-expo's `@/*` -> src/ mapping.
  moduleNameMapper: { '^@/assets/(.*)$': '<rootDir>/assets/$1' },
  preset: 'jest-expo',
};
