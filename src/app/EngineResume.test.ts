import { describe, expect, it } from 'vitest';
import { parseStoryline } from '../engine/config';
import { EngineView } from '../engine/contract';
import { createEngine } from '../engine/sim/engine';
import salesElevator from '../engine/storylines/sales-elevator.json';
import { createI18n } from '../i18n';
import { copyViolations } from '../i18n/copy';
import { buildRecap, lastHeadline } from './EngineResume';
import { runInProgress, showsRecap } from './resume';

const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const i18n = createI18n();

describe('welcome back on the engine', () => {
  it('opens onboarding for a new run and the board with the recap for a run under way', async () => {
    const engine = createEngine(parsed.config, { seed: 1 });
    const fresh = EngineView.parse(engine.view());
    expect(runInProgress(fresh)).toBe(false);
    // Reading profiles in onboarding does not count as a run under way.
    await engine.dispatch({ type: 'openProfile', memberId: fresh.members[0].id });
    expect(runInProgress(EngineView.parse(engine.view()))).toBe(false);

    await engine.dispatch({ type: 'confirmStyles', styles: Object.fromEntries(fresh.members.map(m => [m.id, 'G' as const])) });
    const board = EngineView.parse(engine.view());
    expect(board.phase).toBe('board');
    expect(runInProgress(board)).toBe(true);
    expect(showsRecap(board)).toBe(true);
  });

  it('builds the recap from the engine view only: where, time left, last outcome, inbox urgent first, promises, KPIs', async () => {
    const engine = createEngine(parsed.config, { seed: 1 });
    const fresh = EngineView.parse(engine.view());
    await engine.dispatch({ type: 'confirmStyles', styles: Object.fromEntries(fresh.members.map(m => [m.id, 'G' as const])) });
    const v = EngineView.parse(engine.view());
    const r = buildRecap(i18n, v);
    expect(r).toMatchObject({ period: v.clock.period, periodUnit: v.clock.periodUnit, sub: v.clock.subPeriod, subPeriodUnit: v.clock.subPeriodUnit });
    expect(r.left).toMatch(/left$/);
    expect(r.headline).toBe(lastHeadline(v));
    expect(r.headline).toBe(v.outcome?.headline);
    expect(r.inbox.map(m => m.id).sort()).toEqual(v.inbox.map(m => m.id).sort());
    const urgent = r.inbox.map(m => m.urgent);
    expect(urgent).toEqual([...urgent].sort((a, b) => Number(b) - Number(a)));
    expect(r.promises).toHaveLength(v.promises.filter(p => p.state === 'open').length);
    expect(r.since).toBe('this');
    expect(r.changes).toEqual(v.kpis.map(k => ({ metric: k.metric, start: k.start, now: k.value, trend: k.trend })));
    const words = [r.left, r.headline ?? '', ...r.inbox.flatMap(m => [m.from, m.due ?? '']), ...r.promises.map(p => p.due)];
    expect(words.flatMap(w => copyViolations(w))).toEqual([]);
  });

  it('back in style setting, what changed is the last period, from its summary', async () => {
    const engine = createEngine(parsed.config, { seed: 1 });
    const fresh = EngineView.parse(engine.view());
    await engine.dispatch({ type: 'confirmStyles', styles: Object.fromEntries(fresh.members.map(m => [m.id, 'G' as const])) });
    await engine.dispatch({ type: 'endPeriod' });
    await engine.dispatch({ type: 'startNextPeriod' });
    const v = EngineView.parse(engine.view());
    expect(v.phase).toBe('style');
    const r = buildRecap(i18n, v);
    const last = v.periods[v.periods.length - 1];
    expect(r.since).toBe('last');
    expect(r.changes.map(c => [c.start, c.now])).toEqual(v.kpis.map(k => [last.kpis[k.metric].start, last.kpis[k.metric].end]));
    expect(i18n.t('settings.resume.since', { unit: 'week', which: 'last' })).toBe('Over last week');
    expect(i18n.t('settings.resume.since', { unit: 'week', which: 'this' })).toBe('Since this week began');
  });

  it('falls back to the newest log entry that is not a period end once the outcome is cleared', () => {
    const base = { outcome: null, history: [
      { id: 'a', period: 1, sub: 1, kind: 'style', title: 'Styles', memberIds: [], changes: [] },
      { id: 'b', period: 1, sub: 1, kind: 'interaction', title: '1:1 with Kent went well', memberIds: [], changes: [] },
      { id: 'c', period: 1, sub: 2, kind: 'event', title: 'A price war', memberIds: [], changes: [] }
    ] } as unknown as EngineView;
    expect(lastHeadline(base)).toBe('A price war');
    expect(lastHeadline({ ...base, history: base.history.slice(0, 2) })).toBe('1:1 with Kent went well');
    expect(lastHeadline({ ...base, history: [] })).toBeNull();
  });
});
