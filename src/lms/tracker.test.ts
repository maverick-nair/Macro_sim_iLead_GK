import { describe, expect, it } from 'vitest';
import { parseStoryline } from '../engine/config';
import type { EngineView, Intent } from '../engine/contract';
import { createMockClient } from '../engine/mock';
import { neededStyles } from '../engine/sim/policies';
import { createEngine } from '../engine/sim/engine';
import salesElevator from '../engine/storylines/sales-elevator.json';
import { fakeScorm12, fakeScorm2004 } from './fakeLms';
import { scorm12Adapter, scorm2004Adapter, type LmsAdapter } from './scorm';
import { normalizeLms, type LmsSettings } from './settings';
import { decodeSnapshot, encodeSnapshot, fitSnapshot, periodStarts } from './snapshot';
import { createTracker, lmsState, trackedClient } from './tracker';

const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config = parsed.config;
const skills = config.report.skills.map(s => ({ key: s.key, name: s.name }));

/** The mock's fast forward as intents: the needed styles each week, no actions, `weeks` weeks ended. */
async function weeks(n: number): Promise<Intent[]> {
  const engine = createEngine(config, { seed: 1 });
  const log: Intent[] = [];
  const send = async (i: Intent) => { await engine.dispatch(i); log.push(i); };
  for (let w = 0; w < n && engine.view().phase !== 'ended'; w++) {
    if (engine.view().phase === 'style') await send({ type: 'confirmStyles', styles: await neededStyles(engine, config.thresholds.high, config.lens) });
    await send({ type: 'endPeriod' });
    const v = engine.view();
    if (v.pendingReward) await send({ type: 'chooseReward', reward: v.pendingReward[0] });
    if (engine.view().phase === 'periodEnd') await send({ type: 'startNextPeriod' });
  }
  return log;
}

/** Plays `log` through a tracked mock client on `adapter`, as package mode does. */
async function playTracked(adapter: LmsAdapter, settings: LmsSettings, log: Intent[], hash = 'h1') {
  const tracker = createTracker({ adapter, settings, hash, seed: 1, skills, now: (() => { let t = 0; return () => (t += 60_000); })() });
  let applied: Intent[] = [];
  const inner = createMockClient({ config, seed: 1, replay: tracker.resumeLog(), onReplayed: a => { applied = a; } });
  const first = await inner.view();
  tracker.begin(first, applied);
  const client = trackedClient(inner, tracker);
  let view: EngineView = first;
  for (const i of log) view = (await client.send(i)).view;
  return { tracker, view, first, applied };
}

describe('the LMS state from the view', () => {
  const view = (o: Partial<EngineView>) => ({ phase: 'board', periods: [], clock: { period: 1, periods: 8 }, score: { total: 640, max: 1000 }, report: null, ...o }) as unknown as EngineView;
  it('completion by finishing or by weeks played; the Leadership Score out of 100', () => {
    const fin = normalizeLms({});
    expect(lmsState(view({}), fin, skills)).toMatchObject({ completion: 'incomplete', success: 'unknown', score: { raw: 64, min: 0, max: 100, scaled: 0.64 }, progress: 0, location: 'period:1' });
    const four = normalizeLms({ completion: { kind: 'weeks', weeks: 4 }, pass: { kind: 'score', min: 60 } });
    expect(lmsState(view({ periods: [{}, {}, {}] as never }), four, skills).completion).toBe('incomplete');
    expect(lmsState(view({ periods: [{}, {}, {}, {}] as never }), four, skills)).toMatchObject({ completion: 'completed', success: 'passed', progress: 0.5 });
    expect(lmsState(view({ periods: [{}, {}, {}, {}] as never, score: { total: 590, max: 1000 } as never }), four, skills).success).toBe('failed');
  });
  it('a level pass mark is read from the report at the end, skill by skill too', () => {
    const lv = normalizeLms({ pass: { kind: 'level', min: 2 } });
    const report = { summary: { level: { index: 2 } }, skills: [{ key: skills[0].key, name: skills[0].name, score: 71, level: { index: 3 } }, { key: skills[1].key, name: skills[1].name, score: 30, level: { index: 1 } }] };
    const s = lmsState(view({ phase: 'ended', report: report as never }), lv, skills);
    expect(s).toMatchObject({ completion: 'completed', success: 'passed', progress: 1 });
    expect(s.objectives![0]).toMatchObject({ id: skills[0].key, score: { raw: 71, scaled: 0.71 }, completion: 'completed', success: 'passed' });
    expect(s.objectives![1]).toMatchObject({ success: 'failed' });
    expect(s.objectives![2]).toMatchObject({ score: null, success: 'failed' });
    expect(lmsState(view({ phase: 'ended', report: { summary: { level: null } } as never }), lv, skills).success).toBe('failed');
  });
});

describe('the suspend data snapshot', () => {
  it('round trips, and rejects anything else', () => {
    const s = { v: 1 as const, h: 'abc', s: 1, i: [{ type: 'endPeriod' }] as Intent[] };
    expect(decodeSnapshot(encodeSnapshot(s))).toEqual(s);
    expect(decodeSnapshot('il1:garbage')).toBeNull();
    expect(decodeSnapshot('')).toBeNull();
    expect(decodeSnapshot('{"v":1}')).toBeNull();
    expect(encodeSnapshot(s)).toMatch(/^il1:[A-Za-z0-9+\-$]+$/);
  });

  it('cuts back to the latest period start that fits the limit, else to an empty log', async () => {
    const base = await weeks(3);
    // Conversations do not compress like the rest: noise stands in for what a participant typed.
    let seed = 7;
    const noise = (n: number) => Array.from({ length: n }, () => String.fromCharCode(33 + ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 90))).join('');
    const talk = (n: number): Intent[] => Array.from({ length: n }, () => ({ type: 'sendTurn', interactionId: 'i1', text: noise(300) }));
    const log = [...talk(4), ...base.slice(0, 3), ...talk(4), ...base.slice(3), ...talk(10)];
    const starts = periodStarts(log);
    expect(starts.map(s => s.period)).toEqual([2, 3, 4]);
    const full = fitSnapshot({ h: 'h', s: 1 }, log, 64000);
    expect(full.mode).toBe('full');
    const cut = fitSnapshot({ h: 'h', s: 1 }, log, 4096);
    expect(cut.mode).toBe('period');
    expect(cut.data.length).toBeLessThanOrEqual(4096);
    expect(starts.map(s => s.at)).toContain(cut.kept);
    expect(decodeSnapshot(cut.data)!.i).toEqual(log.slice(0, cut.kept));
    const none = fitSnapshot({ h: 'h', s: 1 }, talk(30), 4096);
    expect(none).toMatchObject({ mode: 'none', kept: 0 });
    expect(decodeSnapshot(none.data)!.i).toEqual([]);
  });
});

describe('tracking a run', () => {
  it('SCORM 2004: commits at period ends, completes and scores at the end, and a relaunch replays to the same view', async () => {
    const lms = fakeScorm2004();
    const adapter = scorm2004Adapter(lms.api);
    adapter.initialize();
    const settings = normalizeLms({ version: 'scorm2004', pass: { kind: 'score', min: 50 } });
    const log = await weeks(8);
    const { tracker, view } = await playTracked(adapter, settings, log);
    expect(view.phase).toBe('ended');
    // One commit at the start, one per period end (the last is also the end of the run), none for the rest.
    expect(lms.commits).toBe(1 + 8);
    const raw = Math.round((100 * view.score.total) / view.score.max);
    expect(lms.data).toMatchObject({ 'cmi.completion_status': 'completed', 'cmi.success_status': raw >= 50 ? 'passed' : 'failed', 'cmi.score.raw': String(raw), 'cmi.progress_measure': '1', 'cmi.location': 'period:8' });
    expect(lms.data['cmi.objectives._count']).toBe(String(skills.length));
    tracker.finish();
    tracker.finish();
    expect(lms.calls.filter(c => c[0] === 'Terminate')).toHaveLength(1);
    expect(lms.data['cmi.exit']).toBe('suspend');
    expect(lms.data['cmi.session_time']).toBe('PT1M');
    expect(adapter.errors).toEqual([]);

    // Relaunched: the LMS hands the suspend data back, the run replays, and the LMS hears the same.
    const again = lms.relaunch();
    const a2 = scorm2004Adapter(again.api);
    a2.initialize();
    const resumed = await playTracked(a2, settings, []);
    expect(resumed.applied).toEqual(log);
    expect(resumed.first.phase).toBe('ended');
    expect(resumed.first.score).toEqual(view.score);
    expect(a2.errors).toEqual([]);
  });

  it('SCORM 1.2: status and score, never more suspend data than 4096 characters, and another storyline starts afresh', async () => {
    const lms = fakeScorm12();
    const adapter = scorm12Adapter(lms.api);
    adapter.initialize();
    const settings = normalizeLms({ version: 'scorm12', completion: { kind: 'weeks', weeks: 2 } });
    const log = await weeks(3);
    await playTracked(adapter, settings, log.slice(0, log.findIndex(i => i.type === 'endPeriod') + 1));
    expect(lms.data['cmi.core.lesson_status']).toBe('incomplete');
    const { tracker } = await playTracked(adapter, settings, log.slice(log.findIndex(i => i.type === 'endPeriod') + 1));
    expect(lms.data['cmi.core.lesson_status']).toBe('completed');
    tracker.finish();
    const sets = lms.calls.filter(c => c[0] === 'LMSSetValue' && c[1] === 'cmi.suspend_data');
    expect(sets.length).toBeGreaterThan(0);
    for (const c of sets) expect(c[2].length).toBeLessThanOrEqual(4096);
    expect(adapter.errors).toEqual([]);
    expect(lms.data['cmi.core.exit']).toBe('suspend');

    const again = lms.relaunch();
    const a2 = scorm12Adapter(again.api);
    a2.initialize();
    expect(createTracker({ adapter: a2, settings, hash: 'h1', seed: 1, skills }).resumeLog()).toEqual(log);
    expect(createTracker({ adapter: a2, settings, hash: 'another version', seed: 1, skills }).resumeLog()).toEqual([]);
  });

  it('a refused intent is not logged', async () => {
    const adapter = scorm2004Adapter(fakeScorm2004().api);
    adapter.initialize();
    const tracker = createTracker({ adapter, settings: normalizeLms({}), hash: 'h', seed: 1, skills });
    const inner = createMockClient({ config, seed: 1 });
    tracker.begin(await inner.view(), []);
    const client = trackedClient(inner, tracker);
    await expect(client.send({ type: 'chooseReward', reward: 'nothing' })).rejects.toThrow();
    expect(tracker.log).toEqual([]);
  });
});
