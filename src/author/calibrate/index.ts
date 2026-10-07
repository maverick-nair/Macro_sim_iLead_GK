import { createElement, lazy, Suspense } from 'react';
import type { CalibrateSlotProps } from './types';

/**
 * GenieKreator's "Test with synthetic players" (D110 to D116, docs/CALIBRATION-SYNTHETIC.md).
 *
 *   <CalibrateSlot config={draft} apiBase={import.meta.env.VITE_GENIE_URL} onResults={keep} />
 *   calibrationPublishCheck(results, { draft })   the "Synthetic players" line of the publish checks
 *
 * This module is light: the screen loads on first render (a lazy chunk), and the engine only with a run,
 * in a Web Worker. Import it from author code only; nothing in the participant app imports it.
 */

const View = lazy(() => import('./ui/CalibrateView'));

export function CalibrateSlot(props: CalibrateSlotProps) {
  return createElement(Suspense, { fallback: createElement('p', { role: 'status', className: 'm-0 text-14 text-fg-secondary' }, 'Loading the synthetic players') }, createElement(View, props));
}

export { calibrationPublishCheck, type CalibrationPublishCheck } from './logic/publish';
export type { CalibrateSlotProps, CalibrationResults, Check, PersonaKey } from './types';
export type { Playthrough } from './logic/schema';
