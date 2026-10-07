/**
 * The demo's guided steps (D92), in order: set a style for the one person left, confirm, select them,
 * choose the instant action, confirm it, and read the impact. Which step is due is read from the demo
 * engine's view and what is on screen. Pure, so it is unit tested.
 */
export type DemoStep = 'style' | 'confirm' | 'select' | 'action' | 'drawer' | 'impact';
export const DEMO_STEPS: DemoStep[] = ['style', 'confirm', 'select', 'action', 'drawer', 'impact'];

export interface DemoState {
  phase: 'style' | 'board' | 'periodEnd' | 'ended';
  /** The action the latest outcome came from, if there is one. */
  outcomeAction: string | null;
  /** The action the demo teaches. */
  action: string;
  /** The person the demo is about has a style picked (style setting). */
  personStyled: boolean;
  /** A modal is open (the styles summary): no tip over it. */
  modalOpen: boolean;
  /** The action's flow is open in the Actions panel. */
  drawerOpen: boolean;
  /** The person the demo is about is selected on the board. */
  selected: boolean;
}

/** The step due now, or null when nothing should point (a modal is open). */
export function demoStep(s: DemoState): DemoStep | null {
  if (s.modalOpen) return null;
  if (s.phase === 'style') return s.personStyled ? 'confirm' : 'style';
  if (s.outcomeAction === s.action) return 'impact';
  if (s.drawerOpen) return 'drawer';
  return s.selected ? 'action' : 'select';
}

/** Where each step points, for the person and the action of this demo. */
export function demoTarget(step: DemoStep, person: string, action: string): string {
  switch (step) {
    case 'style': return `[data-member-id="${person}"] [data-tour="style-control"]`;
    case 'confirm': return '[data-tour="style-confirm"]';
    case 'select': return `[data-tour="member"][data-member-id="${person}"]`;
    case 'action': return `[data-tour="actions"] [data-action="${action}"]`;
    case 'drawer': return '[data-drawer]';
    case 'impact': return '[data-tour="outcome"]';
  }
}
