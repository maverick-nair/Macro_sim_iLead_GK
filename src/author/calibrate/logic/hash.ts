import { seedFrom } from '../../../engine/sim/rng';

/** A stable hash of the draft as authored, to tell when calibration results are out of date. Light: no engine. */
export const configHash = (draft: unknown) => seedFrom(JSON.stringify(draft) ?? '').toString(36);
