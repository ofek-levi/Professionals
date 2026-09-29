import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Only for the drift test, which imports the app's constants (they use the `@/` alias).
    // Backend code never imports `@/…`.
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('../frontend/src/', import.meta.url)) }],
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    // Each file gets its own database + Redis prefix (see test/setup.ts), so files run in parallel.
    pool: 'forks',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    restoreMocks: true,
  },
});
