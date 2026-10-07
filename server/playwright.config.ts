import { defineConfig } from '@playwright/test';

/**
 * End to end against the real server: the app built with `--mode server` (`npm run build:server-app`),
 * served by the server itself with an in memory database, the mock AI and real Chromium PDFs.
 * `npm run e2e:server`. `E2E_SERVER_PORT` picks the port.
 */
const port = Number(process.env.E2E_SERVER_PORT ?? 5741);
export const E2E_SECRET = 'e2e-launch-secret-0123456789-abcdefghijklmnop';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 1440, height: 1000 } },
  webServer: {
    command: 'npm run build:server-app && node --import tsx server/src/index.ts',
    cwd: '..',
    url: `http://localhost:${port}/readyz`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NODE_ENV: 'development', PORT: String(port), PUBLIC_URL: `http://localhost:${port}`, STATIC_DIR: 'dist-server', SQLITE_PATH: ':memory:',
      LAUNCH_SECRET: E2E_SECRET, LOG_LEVEL: 'warn', STREAM_TOKENS_PER_SEC: '60', PDF_ENABLED: 'true', BENCHMARK_REFRESH_HOURS: '0', RATE_LIMIT_LAUNCH_PER_MIN: '100'
    }
  }
});
