/**
@type {import('jest').Config}
*/
module.exports = {
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**', '!**/*.d.ts'],
  preset: 'jest-expo',
};
