import { rememberedRun } from '../../engine/resilient';

/**
 * What the guided tour and the one time tips remember on this device (D94, D99): which tours and tips a
 * participant has seen, and whether they asked never to see tours and tips again. Kept in local storage
 * under one key; a blocked or full storage simply means the tour may offer itself again. Per participant,
 * so two people on one browser each get their first run.
 */
export const GUIDE_KEY = 'ilead.guide';

interface GuideState { never?: boolean; seen?: Record<string, boolean> }

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const storage = (): Store | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

function read(s: Store | null): GuideState {
  try { return JSON.parse(s?.getItem(GUIDE_KEY) ?? '{}') as GuideState; } catch { return {}; }
}
function write(state: GuideState, s: Store | null) {
  try { s?.setItem(GUIDE_KEY, JSON.stringify(state)); } catch { /* storage blocked: the tour may show again */ }
}
const who = () => rememberedRun() ?? 'local';

/** The participant asked never to see tours and tips again. */
export function guideOff(s: Store | null = storage()): boolean {
  return read(s).never === true;
}

/** Whether this participant has seen a tour (`tour:board`) or a tip (`tip:hireUnlocked`). */
export function guideSeen(key: string, s: Store | null = storage()): boolean {
  return read(s).seen?.[`${who()}:${key}`] === true;
}

export function markGuideSeen(key: string, s: Store | null = storage()) {
  const state = read(s);
  write({ ...state, seen: { ...state.seen, [`${who()}:${key}`]: true } }, s);
}

/** "Do not show tours and tips again": every tour stops offering itself; they still replay from the menu. */
export function turnGuideOff(s: Store | null = storage()) {
  write({ ...read(s), never: true }, s);
}
