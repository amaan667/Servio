import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    exclude: ['node_modules/', 'e2e/', '**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        'e2e/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

