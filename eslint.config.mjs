// https://docs.expo.dev/guides/using-eslint/
import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';
import jest from 'eslint-plugin-jest';
import perfectionist from 'eslint-plugin-perfectionist';
import reactNative from 'eslint-plugin-react-native';
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect';
import sonarjs from 'eslint-plugin-sonarjs';
import testingLibrary from 'eslint-plugin-testing-library';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const TS_FILES = ['**/*.ts', '**/*.tsx'];
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'];

// eslint-config-expo already registers the @typescript-eslint plugin and parser, so only the
// type-aware *rules* are taken from typescript-eslint (registering it twice is an error).
const typeCheckedRules = Object.assign(
  {},
  ...tseslint.configs.recommendedTypeCheckedOnly.map((config) => config.rules ?? {}),
);

export default defineConfig([
  // eslint-plugin-react / eslint-plugin-import (bundled by Expo) and eslint-plugin-react-native
  // predate ESLint 10: @eslint/compat shims the context APIs it removed (e.g. getSourceCode).
  fixupConfigRules(expoConfig),
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'coverage/*', '.expo/*'],
  },

  // General code quality
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  perfectionist.configs['recommended-natural'],
  {
    rules: {
      // Import sorting is owned by perfectionist (same as the SPA).
      'import/order': 'off',

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'perfectionist/sort-imports': ['error', { newlinesBetween: 0, type: 'natural' }],

      'sonarjs/deprecation': 'warn',
      'sonarjs/todo-tag': 'warn',
      'unicorn/filename-case': [
        'error',
        { case: 'kebabCase', ignore: [String.raw`^_layout\.tsx$`] },
      ],
      'unicorn/no-array-reduce': 'warn',

      // React Native / SQLite APIs use null; abbreviations like props/ref/params are idiomatic.
      'unicorn/no-null': 'off',
      'unicorn/no-top-level-side-effects': 'off',
      'unicorn/prevent-abbreviations': 'off',
    },
  },
  {
    // Tooling config files: CommonJS consumers, and eslint-plugin-import can't parse the
    // modern syntax (import attributes) used inside some ESLint plugins it would resolve.
    files: ['*.config.js', '*.config.mjs'],
    rules: {
      'import/namespace': 'off',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'unicorn/prefer-module': 'off',
    },
  },

  // TypeScript (type-aware)
  {
    files: TS_FILES,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...typeCheckedRules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // React / React Native
  reactYouMightNotNeedAnEffect.configs.strict,
  {
    plugins: { 'react-native': fixupPluginRules(reactNative) },
    rules: {
      'react-native/no-color-literals': 'error',
      'react-native/no-inline-styles': 'error',
      'react-native/no-unused-styles': 'error',
    },
  },

  // Tests
  {
    files: TEST_FILES,
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      ...jest.configs['flat/style'].rules,
    },
  },
  {
    files: TEST_FILES,
    ...testingLibrary.configs['flat/react'],
  },

  // Must stay last: turns off rules that conflict with Prettier.
  prettierConfig,
]);
