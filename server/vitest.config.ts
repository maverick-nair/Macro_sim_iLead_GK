import { defineConfig } from 'vitest/config';

/** Server unit and integration tests: in memory SQLite, the mock AI, fake SMTP and PDF where needed. `npm run test:server`. */
export default defineConfig({
  test: {
    include: ['server/test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['server/src/quiet.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000
  }
});
