/**
 * ASSIZE mobile — the COMPONENT gate (jest-expo).
 *
 * vitest owns the pure logic (including the web build's own engine suites).
 * jest-expo owns anything that must render React Native: screens, the board,
 * platform adapters that touch native modules.
 *
 * Tests live under each src directory's `__tests__` folder, as .test.ts / .test.tsx.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts', '<rootDir>/src/**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@shared$': '<rootDir>/../shared/index.ts',
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // babel.config.js (babel-preset-expo) handles TS/JSX for both Metro and jest.
  // transformIgnorePatterns is deliberately NOT overridden: the jest-expo preset
  // already carries the correct allow-list for React Native's Flow-typed sources,
  // and replacing it makes the Flow parser choke on them.
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**'],
};
