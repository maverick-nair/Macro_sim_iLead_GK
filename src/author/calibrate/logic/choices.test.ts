import { describe, expect, it } from 'vitest';
import { choiceDistance, checks, type CheckContext } from './aggregate';
import type { PersonaKey, RunResult } from './schema';

/** The choices check (D137, D140): a storyline with choice events must have levels that choose differently. */

const base = (persona: PersonaKey, choices: RunResult['choices']): RunResult => ({
  persona, index: 0, seed: 1, probe: null, score: 500, max: 1000, tier: { key: 'silver', name: 'Silver', index: 2 }, share: 0.8, level: null, skills: [], adaptability: 50,
  bands: { strong: 0, adequate: 0, weak: 0, harmful: 0 }, concerns: [], actions: {}, events: { expected: 0, handled: 0 }, choices
});
const ctx = (runs: RunResult[]): CheckContext => ({ personas: [], runs, probes: [], probesRan: false, target: { key: 'gold', name: 'Gold', min: 700 }, scale: [], scoreMax: 1000, actions: [], styles: [] });

describe('the choices check', () => {
  it('measures how far apart two levels choose: 0 alike, 1 never the same, a default its own outcome', () => {
    const a = [base('beginner', [{ event: 'x', option: 'cut', by: 'you' }]), base('beginner', [{ event: 'x', option: 'cut', by: 'default' }])];
    const b = [base('expert', [{ event: 'x', option: 'cut', by: 'you' }]), base('expert', [{ event: 'x', option: 'keep', by: 'you' }])];
    expect(choiceDistance(a, a)).toBe(0);
    expect(choiceDistance(a, b)).toBe(0.5);
    expect(choiceDistance([base('beginner', [])], [base('expert', [])])).toBeNull();
  });

  it('fails when Beginners and Experts end on the same options, passes when they differ, and says nothing without choices', () => {
    const same = [base('beginner', [{ event: 'x', option: 'cut', by: 'you' }]), base('expert', [{ event: 'x', option: 'cut', by: 'you' }])];
    const apart = [base('beginner', [{ event: 'x', option: 'cut', by: 'default' }]), base('expert', [{ event: 'x', option: 'keep', by: 'you' }])];
    expect(checks(ctx(same)).find(c => c.key === 'choices')).toMatchObject({ status: 'fail' });
    expect(checks(ctx(apart)).find(c => c.key === 'choices')).toMatchObject({ status: 'pass', detail: 'Beginner and Expert choices are 100% apart.' });
    expect(checks(ctx([base('beginner', undefined), base('expert', undefined)])).find(c => c.key === 'choices')).toBeUndefined();
  });
});
