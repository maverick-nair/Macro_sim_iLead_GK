import { defineConfig } from '@playwright/test';

/** End to end flows against the dev server on the mock engine. `npm run e2e`. */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5198', viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'npx vite --port 5198 --strictPort', url: 'http://localhost:5198', reuseExistingServer: true, timeout: 60_000 }
});
