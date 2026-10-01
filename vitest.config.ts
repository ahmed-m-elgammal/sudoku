import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['shared/__tests__/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@shared': path.resolve(__dirname, 'shared'), '@': path.resolve(__dirname, 'src') },
  },
});
