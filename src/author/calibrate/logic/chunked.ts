import { wordEnglish } from '../../../i18n/engineCopyEn';
import { CalibrateClientError, cancelled, find, type CalibrationRunner } from './client';
import { CalibrationError, runCalibration } from './run';

/** In the page, a playthrough at a time with the thread given back in between. */
export function createChunkedRunner(): CalibrationRunner {
  return {
    async run(draft, settings, opts = {}) {
      try {
        const out = await runCalibration(draft, settings, { ranOn: 'browser', word: wordEnglish, onProgress: opts.onProgress, signal: opts.signal });
        return { results: out.results, playthrough: async (p, i) => find(out.playthroughs, p, i) };
      } catch (e) {
        if (e instanceof CalibrationError) throw e.code === 'cancelled' ? cancelled() : new CalibrateClientError(e.message, e.code, e.issues);
        throw e;
      }
    }
  };
}

