// ASSIZE mobile — the LOGIC + component gate.
//
// NOTE ON jest-expo: `jest` is configured (jest.config.js + jest.setup.js) but is NOT
// part of the gate in this environment. jest-expo's transform pipeline fails to parse
// React Native's Flow-typed sources under Node 22 here ("unexpected token" from the
// Flow parser), which is a toolchain incompatibility, not a fault in the app code.
//
// So: vitest is the single test runner. It runs the web build's own engine suites, the
// fx-law suite, and every new mobile test — including component tests, which are written
// with react-test-renderer (no jest, no extra testing library).
//
// To use jest later, fix the Flow transform first; do not work around it by editing app
// code.

import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import path from 'node:path';

const mobileSrc = path.resolve(__dirname, 'src');

/** Redirect the engine suites' web-runtime import onto the mobile port. */
function redirectWebRuntime(): Plugin {
  return {
    name: 'assize:redirect-web-runtime',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null;
      const normalized = source.replace(/\\/g, '/');
      if (!/src\/game\/localDuel$/.test(normalized)) return null;
      return path.resolve(mobileSrc, 'game/localDuel.ts');
    },
  };
}

export default defineConfig({
  plugins: [redirectWebRuntime()],
  test: {
    include: [
      '../shared/__tests__/**/*.test.ts',
      '../tests/juice.test.ts',
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // The web build's PNG-compression pipeline test (sharp, ../public/assets). A
      // build-time asset concern for the PWA; no bearing on the mobile bundle.
      '../tests/pngCompression.test.ts',
    ],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30_000,
  },
  resolve: {
    alias: [
      { find: '@/audio/synth', replacement: path.resolve(mobileSrc, 'platform/audio') },
      { find: '@shared', replacement: path.resolve(__dirname, '../shared') },
      { find: '@', replacement: mobileSrc },
    ],
  },
});
