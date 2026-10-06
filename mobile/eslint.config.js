// ASSIZE mobile — lint gate.
//
// eslint-config-expo provides the RN/TS rules. On top of it this file enforces the
// two hard UI laws of this project as MACHINE CHECKS, not as advice:
//
//   1. NO HARDCODED COLOURS OR THEME VALUES outside src/theme/. A hex or rgba() literal
//      in a component is a lint error. Every colour, size and duration comes from
//      @/theme/tokens. This is what stops 24 screens drifting into 24 palettes.
//   2. Tests are exempt from both, so a test may assert a literal value.
const expoConfig = require('eslint-config-expo/flat');

/**
 * `src/game/**` holds the duel RUNTIMES — plain TypeScript classes, not React. They
 * import React only for types (and never call a hook). The rules-of-hooks rule cannot
 * know that, and it false-positives on the engine's own `useAbility` import, which it
 * mistakes for a hook. So the rule is scoped to real React code instead of being
 * switched off repo-wide.
 */


module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'android/**', 'ios/**'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // ---- LAW 1: the single source of truth for the look is src/theme/tokens.ts
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**', 'src/**/__tests__/**', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^(#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\()/]",
          message:
            'Hardcoded colour. Import it from @/theme/tokens (palette, themeFor, seat, type, layout, motion) or add it there first.',
        },
      ],
    },
  },
  {
    // ---- tests may assert literals; that is their job
    files: ['src/**/__tests__/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    // ---- Static asset registries: Metro bundles images and SVGs only through
    //      static require() literals.
    files: ['src/theme/assets.ts', 'src/ui/duel/duelAssets.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // ---- LAW 3: the engine and the platform seams stay pure. A screen may not
    //      import the engine's internals directly; it goes through duelRuntime/fx.
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@shared/engine', '@shared/sudoku', '@shared/rng', '@shared/replay', '@shared/personalShade'],
              message:
                'A screen must not drive the engine. Render the DuelRuntime surface (src/game/duelRuntime) and read src/game/fx.ts for presentation law.',
            },
          ],
        },
      ],
    },
  },
  {
    // ---- the jest setup/config files use jest's injected globals.
    // Note: vitest is the gate runner (vitest.config.ts explains why jest-expo cannot
    // run here); these files are kept wired so `npm run test:component` works the day
    // the Flow transform is fixed. Declaring the globals is what makes them lintable.
    files: ['jest.config.js', 'jest.setup.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
  {
    // ---- hooks rules apply to React code only (see the note at the top)
    files: ['src/game/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];
