import { describe, expect, it } from 'vitest';
import { defaultStoryline } from './mock';
import { jumpParam, jumpTo, parseJump, weekOf, type JumpTarget } from './jump';
import { createEngine } from './sim/engine';
import clientTrust from './storylines/client-trust.json';
import { parseStoryline, type StorylineInput } from './config';

const trust = () => { const r = parseStoryline(clientTrust as unknown as StorylineInput); if (!r.ok) throw new Error(r.issues[0]); return r.config; };

describe('a preview\'s Jump to (D192)', () => {
  it('reads and writes targets', () => {
    expect(parseJump('board:3')).toEqual({ to: 'board', week: 3 });
    expect(parseJump('styles')).toEqual({ to: 'styles', week: 1 });
    expect(parseJump('event:price_war')).toEqual({ to: 'event', key: 'price_war' });
    expect(parseJump('report')).toEqual({ to: 'report' });
    for (const bad of ['', 'board:0', 'board:x', 'event:Bad Key', 'nowhere', null]) expect(parseJump(bad)).toBeNull();
    for (const t of ['onboarding', 'board:2', 'weekend:4', 'action:coach', 'end'] as const) expect(jumpParam(parseJump(t)!)).toBe(t);
  });

  it('finds the week of an event and an action, never past the last', () => {
    const c = defaultStoryline();
    const fixed = c.events.find(e => e.period !== undefined)!;
    expect(weekOf({ to: 'event', key: fixed.key }, c)).toBe(fixed.period);
    const later = c.actions.find(a => a.unlockPeriod > 1)!;
    expect(weekOf({ to: 'action', key: later.key }, c)).toBe(later.unlockPeriod);
    expect(weekOf({ to: 'board', week: 99 }, c)).toBe(c.time.period.count);
    expect(weekOf({ to: 'event', key: 'missing' }, c)).toBe(1);
  });

  for (const [name, config] of [['Sales Elevator', defaultStoryline()], ['Client Trust', trust()]] as const) {
    it(`plays ${name} to each point`, async () => {
      const at = async (t: JumpTarget) => { const e = createEngine(config, { seed: 1 }); await jumpTo(e, config, t); return e.view(); };
      expect((await at({ to: 'onboarding' })).clock.period).toBe(1);
      expect(await at({ to: 'styles', week: 3 })).toMatchObject({ phase: 'style', clock: { period: 3 } });
      expect(await at({ to: 'board', week: 2 })).toMatchObject({ phase: 'board', clock: { period: 2 } });
      expect(await at({ to: 'weekend', week: 1 })).toMatchObject({ phase: 'periodEnd', clock: { period: 1 } });
      const end = await at({ to: 'report' });
      expect(end.phase).toBe('ended');
      expect(end.report).not.toBeNull();
    });
  }
});
