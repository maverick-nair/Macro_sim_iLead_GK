/**
 * The guided tours (D94): the board's, a short one for style setting and one for the live screen, in
 * 1.0's tip order, worded for 2.0. Each step points at an element marked `data-tour`; a step whose element
 * is not on screen (no outcome yet, a format without hints) is skipped. The words are in guide.json, keyed
 * `tour.<area>.<step>`, and a storyline may reword any step (`tour.steps` in its config).
 */
export type TourArea = 'board' | 'style' | 'live';

export interface TourStepDef {
  key: string;
  /** Tried in order; the first that matches is the target. */
  targets: string[];
}

const at = (...names: string[]) => names.map(n => `[data-tour="${n}"]`);

export const TOURS: Record<TourArea, TourStepDef[]> = {
  board: [
    { key: 'menu', targets: at('menu') },
    { key: 'clock', targets: at('clock') },
    { key: 'days', targets: at('days') },
    { key: 'session', targets: at('session') },
    { key: 'stages', targets: at('stage') },
    { key: 'member', targets: at('member') },
    { key: 'notifications', targets: at('outcome', 'inbox') },
    { key: 'kpis', targets: at('kpis') },
    { key: 'target', targets: at('target') },
    { key: 'overview', targets: at('overview') },
    { key: 'actions', targets: at('actions') },
    { key: 'duration', targets: at('action-cost') },
    { key: 'end', targets: at('end') }
  ],
  style: [
    { key: 'styles', targets: at('style-definitions') },
    { key: 'choose', targets: at('style-control') },
    { key: 'reason', targets: at('style-reason') },
    { key: 'confirm', targets: at('style-confirm') }
  ],
  live: [
    { key: 'brief', targets: at('live-brief') },
    { key: 'talk', targets: at('live-input') },
    { key: 'hint', targets: at('live-hint') },
    { key: 'end', targets: at('live-end') }
  ]
};

/** The first matching target of a step, or null when none is on screen. */
export function findTarget(step: TourStepDef, root: Pick<Document, 'querySelector'> = document): string | null {
  for (const sel of step.targets) {
    const el = root.querySelector(sel) as HTMLElement | null;
    if (el && (typeof el.checkVisibility !== 'function' || el.checkVisibility())) return sel;
  }
  return null;
}
