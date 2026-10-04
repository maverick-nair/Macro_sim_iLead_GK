import { expect, test } from '@playwright/test';

/**
 * Smoke for MediaRecorderSpeechProvider on Chromium's fake microphone (a synthetic beep, no real
 * audio): permission, AnalyserNode levels and MediaRecorder chunks reach the transcription client.
 * The page is a test only fixture (tests/e2e/fixtures/speech.html) served by the Vite dev server.
 */
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] }
});

interface HarnessResult {
  permission: string;
  levels: number[];
  partials: string[];
  finals: string[];
  errors: unknown[];
  speechStarts: number;
  transcript: string | null;
  received: { streams: number; chunks: number; bytes: number; mimeTypes: string[]; finished: number; aborted: number };
}
const read = () => (window as unknown as { __speech: HarnessResult }).__speech;

test('MediaRecorderSpeechProvider gets levels and chunks from the fake device', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/e2e/fixtures/speech.html');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('#status')).toHaveText('listening');
  // Let a few 200ms chunks and the fake device's beeps through.
  await expect.poll(() => page.evaluate(read).then(r => r.received.chunks), { timeout: 10_000 }).toBeGreaterThanOrEqual(6);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('#status')).toHaveText('done');

  const r = await page.evaluate(read);
  expect(r.permission).toBe('granted');
  expect(r.errors).toEqual([]);
  expect(r.speechStarts).toBe(1);
  expect(r.received).toMatchObject({ streams: 1, finished: 1, aborted: 0 });
  expect(r.received.bytes).toBeGreaterThan(0);
  expect(r.received.mimeTypes[0]).toMatch(/^audio\/webm/);
  expect(r.levels.length).toBeGreaterThan(10);
  expect(r.levels.every(l => l >= 0 && l <= 1)).toBe(true);
  // The fake device beeps, so some samples are well above silence.
  expect(Math.max(...r.levels)).toBeGreaterThan(0.3);
  expect(r.partials.length).toBeGreaterThan(0);
  expect(r.transcript).toBe('Hello team. What is blocking you this week?');
  expect(errors).toEqual([]);
});
