import { defineConfig } from '@playwright/test';

/** End to end flows against the dev server on the mock engine. `npm run e2e`. `E2E_PORT` picks another port. */
const port = Number(process.env.E2E_PORT ?? 5198);
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 1440, height: 1000 } },
  webServer: { command: `npx vite --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: true, timeout: 60_000 }
});
