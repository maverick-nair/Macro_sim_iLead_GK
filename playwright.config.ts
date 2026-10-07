import { defineConfig } from '@playwright/test';

/** End to end flows against the dev server on the mock engine. `npm run e2e`. `E2E_PORT` picks another port. */
const port = Number(process.env.E2E_PORT ?? 5198);
const baseURL = `http://localhost:${port}`;
/**
 * Every flow starts as a participant who has turned tours and tips off (D94, D99), so a tip never stands in
 * a flow's way. The tour's own tests (`guide.spec.ts`) start with no storage, as a first run does.
 */
export const GUIDE_OFF = { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'ilead.guide', value: JSON.stringify({ never: true }) }] }] };
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { baseURL, viewport: { width: 1440, height: 1000 }, storageState: GUIDE_OFF },
  webServer: { command: `npx vite --port ${port} --strictPort`, url: baseURL, reuseExistingServer: true, timeout: 60_000 }
});
