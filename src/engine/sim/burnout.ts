import type { StorylineInput } from '../config';

/**
 * The first engine audit's burnout experiment (D135): every fitting effect becomes morale −8, result +14, so a
 * player who reads people well burns them out for result. Without people dynamics the funnel read only result,
 * and burnout won (revenue 174% of target, team morale 1, nobody left, Gold). With dynamics it must not beat
 * balanced play. Used by the test (`dynamics.test.ts`) and documented in docs/SIMULATION.md 3.5.
 */
export function burnout(storyline: StorylineInput): StorylineInput {
  const s = structuredClone(storyline);
  const burn = (e: readonly [number, number, number]) => [e[0], -8, 14] as [number, number, number];
  s.weeklyStyle = { ...s.weeklyStyle, m0: burn(s.weeklyStyle.m0) };
  s.actions = s.actions.map(a => ({ ...a, options: a.options.map(o => ({ ...o, effects: { ...o.effects, m0: burn(o.effects.m0) } })) }));
  return s;
}
