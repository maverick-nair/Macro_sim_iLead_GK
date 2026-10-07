import { wordEnglish } from '../../../i18n/engineCopyEn';
import { CalibrationError, runCalibration } from './run';
import type { CalibrationSettingsInput } from './schema';

/**
 * The calibration in a Web Worker (D118): the engine plays every playthrough off the page's thread, so the
 * author's screen stays responsive. Messages: `{ draft, settings }` in; `progress`, then `done` or `error` out.
 * Cancelling terminates the worker.
 */
const scope = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage(message: unknown): void };

scope.onmessage = async (e: MessageEvent<{ draft: unknown; settings: CalibrationSettingsInput }>) => {
  try {
    const out = await runCalibration(e.data.draft, e.data.settings, {
      ranOn: 'browser',
      word: wordEnglish,
      onProgress: (done, total) => scope.postMessage({ type: 'progress', done, total }),
      yieldEvery: async () => undefined
    });
    scope.postMessage({ type: 'done', ...out });
  } catch (err) {
    const c = err instanceof CalibrationError ? err : null;
    scope.postMessage({ type: 'error', code: c?.code ?? 'failed', message: c?.message ?? 'The test could not run.', issues: c?.issues ?? [] });
  }
};
