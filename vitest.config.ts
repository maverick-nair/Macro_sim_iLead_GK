import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'ai/**/*.test.ts'], exclude: ['**/node_modules/**'], environment: 'node' }
});
