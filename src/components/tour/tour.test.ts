import { describe, expect, it } from 'vitest';
import { demoStep, demoTarget, DEMO_STEPS } from '../demo/demoSteps';
import { dueTips, newMilestones } from '../board/notices';
import { placeTip } from './Coachmark';
import { guideOff, guideSeen, markGuideSeen, turnGuideOff } from './guideStore';
import { findTarget, TOURS } from './steps';

/** A storage stand in, as local storage behaves. */
function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
}

describe('guided tour (D94)', () => {
  it('places a tip below its target, else above, else beside, inside the window; tall targets get it beside', () => {
    const view = { width: 1280, height: 720 }, tip = { width: 340, height: 200 };
    expect(placeTip({ top: 100, left: 50, width: 200, height: 40 }, tip, view)).toEqual({ top: 152, left: 50 });
    expect(placeTip({ top: 600, left: 50, width: 200, height: 40 }, tip, view)).toEqual({ top: 388, left: 50 });
    // Near the right edge the tip moves left to stay inside.
    expect(placeTip({ top: 100, left: 1200, width: 60, height: 40 }, tip, view).left).toBe(1280 - 340 - 16);
    // A tall panel on the right: the tip sits to its left.
    expect(placeTip({ top: 100, left: 900, width: 330, height: 560 }, tip, view)).toEqual({ top: 100, left: 900 - 12 - 340 });
    // No target: the middle of the window.
    expect(placeTip(null, tip, view)).toEqual({ top: 260, left: 470 });
  });

  it('has the board, style setting and live tours in 1.0\'s order, each step with a target', () => {
    expect(TOURS.board.map(s => s.key)).toEqual(['menu', 'clock', 'days', 'session', 'stages', 'member', 'notifications', 'kpis', 'target', 'overview', 'actions', 'duration', 'end']);
    expect(TOURS.style).toHaveLength(4);
    expect(TOURS.live).toHaveLength(4);
    for (const area of Object.values(TOURS)) for (const s of area) expect(s.targets.length).toBeGreaterThan(0);
    const root = { querySelector: (sel: string) => (sel === '[data-tour="inbox"]' ? ({} as Element) : null) };
    expect(findTarget(TOURS.board[6], root as unknown as Document)).toBe('[data-tour="inbox"]');
    expect(findTarget(TOURS.board[0], root as unknown as Document)).toBeNull();
  });

  it('remembers what was seen per participant, and "do not show again" for every tour and tip', () => {
    const s = memory();
    expect(guideSeen('tour:board', s)).toBe(false);
    markGuideSeen('tour:board', s);
    expect(guideSeen('tour:board', s)).toBe(true);
    expect(guideSeen('tour:style', s)).toBe(false);
    expect(guideOff(s)).toBe(false);
    turnGuideOff(s);
    expect(guideOff(s)).toBe(true);
    expect(guideSeen('tour:board', s)).toBe(true);
    // Blocked storage: nothing is remembered and nothing throws.
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(guideOff(blocked)).toBe(false);
    expect(() => markGuideSeen('x', blocked)).not.toThrow();
  });
});

describe('demo steps (D92)', () => {
  const base = { phase: 'style' as const, outcomeAction: null, action: 'training', personStyled: false, modalOpen: false, drawerOpen: false, selected: false };
  it('walks style, confirm, select, action, drawer and impact', () => {
    expect(demoStep(base)).toBe('style');
    expect(demoStep({ ...base, personStyled: true })).toBe('confirm');
    expect(demoStep({ ...base, personStyled: true, modalOpen: true })).toBeNull();
    const board = { ...base, phase: 'board' as const, outcomeAction: 'styles' };
    expect(demoStep(board)).toBe('select');
    expect(demoStep({ ...board, selected: true })).toBe('action');
    expect(demoStep({ ...board, selected: true, drawerOpen: true })).toBe('drawer');
    expect(demoStep({ ...board, outcomeAction: 'training' })).toBe('impact');
    expect(DEMO_STEPS.map(s => demoTarget(s, 'kent', 'training'))).toEqual([
      '[data-member-id="kent"] [data-tour="style-control"]', '[data-tour="style-confirm"]', '[data-tour="member"][data-member-id="kent"]',
      '[data-tour="actions"] [data-action="training"]', '[data-drawer]', '[data-tour="outcome"]'
    ]);
  });
});

describe('notices (D93, D99)', () => {
  const view = {
    phase: 'board' as const, live: null,
    clock: { period: 3, periods: 8, periodUnit: 'week' as const, subPeriod: 1, subPeriodUnit: 'day' as const, capacity: 5, capacityLeft: 5, costStep: 1, runShare: 0.3 },
    actions: [{ rule: 'hire', unlockPeriod: 3, blocked: null }] as never,
    funnel: [{ key: 'leads', members: 2, ideal: 2 }, { key: 'qualify', members: 1, ideal: 2 }] as never,
    milestones: [{ key: 'target:25', kind: 'target' as const, stage: null, pct: 25, period: 2, sub: 3 }]
  };
  it('tips: Hire opens, no days left, an open seat; none off the plain board', () => {
    expect(dueTips(view).map(n => n.key)).toEqual(['tip:hireUnlocked', 'tip:seatOpen:qualify']);
    expect(dueTips({ ...view, clock: { ...view.clock, capacityLeft: 0 } }).map(n => n.key)).toContain('tip:noDays');
    expect(dueTips({ ...view, clock: { ...view.clock, period: 2 } }).map(n => n.key)).not.toContain('tip:hireUnlocked');
    expect(dueTips({ ...view, phase: 'style' })).toEqual([]);
  });
  it('milestones not shown yet', () => {
    expect(newMilestones(view, new Set()).map(n => n.key)).toEqual(['milestone:target:25']);
    expect(newMilestones(view, new Set(['milestone:target:25']))).toEqual([]);
  });
});
