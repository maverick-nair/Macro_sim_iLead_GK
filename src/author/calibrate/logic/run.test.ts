import { describe, expect, it } from 'vitest';
import raw from '../../../engine/storylines/sales-elevator.json';
import type { Copy } from '../../../engine/copy';
import type { Evaluation } from '../../../engine/sim/types';
import { copyViolations } from '../../../i18n/copy';
import { explain } from './explain';
import { configHash } from './hash';
import { calibrationPublishCheck } from './publish';
import { CalibrationError, checkedPlan, plan, parseDraft, runCalibration } from './run';
import { CalibrationResults, CalibrationSettings, MAX_PLAYTHROUGHS, MAX_PROBE_ACTIONS, Playthrough } from './schema';

const ev = (o: Partial<Omit<Evaluation, 'flags'>> & { flags?: Partial<Evaluation['flags']> } = {}): Evaluation => ({
  styleUsed: 'G', confidence: 1, band: 'adequate', evidence: [], dimensions: [{ key: 'listening', band: 'strong', evidence: [] }, { key: 'clarity', band: 'adequate', evidence: [] }], redFlags: [],
  ...o,
  flags: { openQuestions: 1, acknowledged: true, invitedContribution: false, specificNextStep: true, concernSurfaced: false, abusive: false, ...o.flags }
});

describe('why a conversation got its rating', () => {
  it('says what was done and missed, the rubric and the style fit', () => {
    expect(explain({ evaluation: ev({ flags: { promise: { text: 'x', dueInSubPeriods: 3, fulfilledBy: [] } } }), format: 'roleplay', name: 'Kent', intended: 'Guiding', shown: 'Guiding', fit: true, needLabel: 'Keen to learn', concern: true, surfaced: false, tagged: true }))
      .toBe("Why Adequate: acknowledged how Kent feels, asked an open question, agreed a clear next step and made a promise to follow up, but did not explore what is really bothering Kent, so the concern stayed hidden. Rubric: listening Strong and clarity Adequate. The words read as Guiding, which fit Kent's need (keen to learn).");
    expect(explain({ evaluation: ev({ band: 'weak', styleUsed: 'D', flags: { openQuestions: 0, acknowledged: false, specificNextStep: false } }), format: 'chat', name: 'Beth', intended: 'Partnering', shown: 'Directing', fit: false, needLabel: null, concern: false, surfaced: false, tagged: true }))
      .toBe("Why Weak: asked no open question, left no clear next step and did not acknowledge how they feel. Rubric: listening Strong and clarity Adequate. The words read as Directing, which did not fit Beth's need. The player meant Partnering, but the words did not show it.");
    expect(explain({ evaluation: ev({ band: 'harmful', redFlags: ['blame'] }), format: 'roleplay', name: 'Kent', intended: null, shown: null, fit: null, needLabel: null, concern: false, surfaced: false, tagged: true }))
      .toBe('Why Harmful: the words included blaming the person, which makes any conversation Harmful.');
    expect(explain({ evaluation: null, format: 'roleplay', name: null, intended: null, shown: null, fit: null, needLabel: null, concern: false, surfaced: false, tagged: false })).toMatch(/ended before anything was rated/);
  });
});

describe('a calibration run', () => {
  it('plays every persona and the probes, and passes on Sales Elevator', async () => {
    const progress: Array<[number, number]> = [];
    const { results, playthroughs } = await runCalibration(raw, { personas: { beginner: 2, developing: 2, proficient: 2, expert: 2 }, seed: 3 }, { ranOn: 'cli', onProgress: (d, t) => progress.push([d, t]), yieldEvery: async () => undefined });
    expect(CalibrationResults.parse(results)).toBeTruthy();
    expect(results.runs).toHaveLength(8);
    // Two seeds for each style and each action.
    expect(results.probes).toHaveLength(2 * (4 + raw.actions.length));
    expect(progress[0]).toEqual([0, 8 + results.probes.length]);
    expect(progress.at(-1)).toEqual([8 + results.probes.length, 8 + results.probes.length]);
    expect(results.checks.filter(c => c.status === 'fail')).toEqual([]);
    expect(results.checks.find(c => c.key === 'ordered')?.status).toBe('pass');
    expect(results.configHash).toBe(configHash(raw));
    expect(results.players).toBe('templates');
    expect(playthroughs).toHaveLength(8);
    const p = Playthrough.parse(playthroughs.find(x => x.persona === 'expert'));
    expect(p.weeks).toHaveLength(8);
    expect(p.weeks[0].actions.length).toBeGreaterThan(0);
    const talk = p.conversations.find(c => c.format === 'roleplay')!;
    expect(talk.why).toMatch(/^Why (Strong|Adequate|Weak|Harmful): /);
    expect(talk.turns.length).toBeGreaterThan(2);
    for (const pt of playthroughs) for (const c of pt.conversations) expect(copyViolations(c.why), c.why).toEqual([]);
    expect(calibrationPublishCheck(results, { draft: raw })).toMatchObject({ blocking: false, action: 'See results' });
  });

  it('replays exactly for the same draft and settings', async () => {
    const s = { personas: { developing: 1, expert: 1 }, seed: 9, probes: false };
    const a = await runCalibration(raw, s, { ranOn: 'cli', yieldEvery: async () => undefined });
    const b = await runCalibration(raw, s, { ranOn: 'cli', yieldEvery: async () => undefined });
    expect(b.results.runs).toEqual(a.results.runs);
    expect(b.playthroughs).toEqual(a.playthroughs);
  });

  it('refuses a draft that does not play, and settings out of range', async () => {
    await expect(runCalibration({ ...raw, members: [] }, {}, { ranOn: 'cli' })).rejects.toMatchObject({ code: 'badStoryline' });
    await expect(runCalibration(raw, { personas: { expert: 0 } }, { ranOn: 'cli' })).rejects.toBeInstanceOf(CalibrationError);
    expect(CalibrationSettings.safeParse({ personas: { expert: 26 } }).success).toBe(false);
    expect(() => parseDraft({})).toThrow(CalibrationError);
  });

  it('stops when cancelled', async () => {
    const ctl = new AbortController();
    const p = runCalibration(raw, { personas: { expert: 3 } }, { ranOn: 'browser', signal: ctl.signal, onProgress: d => { if (d === 1) ctl.abort(); } });
    await expect(p).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('reports a cancel mid playthrough as cancelled, not failed', async () => {
    const ctl = new AbortController();
    let calls = 0;
    const word = (c: Copy) => { if (++calls === 1) ctl.abort(); return typeof c === 'string' ? c : 'code' in c ? c.code : c.template; };
    const p = runCalibration(raw, { personas: { expert: 1 }, probes: false }, { ranOn: 'browser', signal: ctl.signal, word });
    await expect(p).rejects.toMatchObject({ name: 'CalibrationError', code: 'cancelled' });
    expect(calls).toBeGreaterThanOrEqual(1);
  });

  it('probes at most MAX_PROBE_ACTIONS actions, so the run stays under MAX_PLAYTHROUGHS', () => {
    const extra = Array.from({ length: 60 }, (_, i) => ({ ...raw.actions[0], key: `extra_${i}` }));
    const config = parseDraft({ ...raw, actions: [...raw.actions, ...extra] });
    const s = CalibrationSettings.parse({ personas: { beginner: 25, developing: 25, proficient: 25, expert: 25 } });
    const { runs, probes } = checkedPlan(config, s);
    expect(probes.filter(p => p.probe.kind === 'action')).toHaveLength(2 * MAX_PROBE_ACTIONS);
    expect(runs.length + probes.length).toBeLessThanOrEqual(MAX_PLAYTHROUGHS);
  });

  it('plans seeds per persona, so every persona meets the same team', () => {
    const { runs, probes } = plan(parseDraft(raw), CalibrationSettings.parse({ personas: { beginner: 2, expert: 2 }, seed: 5, probes: false }));
    expect(runs.map(r => `${r.persona}:${r.seed}`)).toEqual(['beginner:5', 'beginner:6', 'expert:5', 'expert:6']);
    expect(probes).toEqual([]);
  });
});

describe('the publish check', () => {
  const base = async () => (await runCalibration(raw, { personas: { beginner: 1, expert: 1 }, probes: false }, { ranOn: 'cli', yieldEvery: async () => undefined })).results;

  it('reads not run, passed, advisory, failed and out of date', async () => {
    expect(calibrationPublishCheck(null)).toMatchObject({ status: 'notRun', blocking: false, action: 'Run the test' });
    const r = await base();
    const [beginner, expert] = r.personas;
    const pass = {
      ...r, checks: r.checks.map(c => ({ ...c, status: 'pass' as const })), settings: { ...r.settings, probes: true },
      personas: [beginner, { ...beginner, persona: 'developing' as const }, { ...expert, persona: 'proficient' as const }, expert]
    };
    expect(calibrationPublishCheck(pass)).toEqual({ key: 'syntheticPlayers', title: 'Synthetic players', status: 'passed', blocking: false, summary: '4 playthroughs at four levels: scores rise with proficiency, Experts reach the target, Beginners do not.', details: [], action: 'See results' });
    // A run that left levels out, or had the probes off, is not a full test: advisory, whatever its checks say.
    const partial = { ...pass, personas: r.personas, settings: r.settings };
    expect(calibrationPublishCheck(partial)).toMatchObject({
      status: 'advisory', blocking: false, action: 'Run the test again',
      summary: '2 playthroughs at two levels: scores rise with proficiency, Experts reach the target, Beginners do not. Not a full test: run all four levels with the probes on before you publish.',
      details: ['Developing and Proficient players did not play', 'The strategy probes were off, so a single winning strategy was not checked']
    });
    expect(calibrationPublishCheck({ ...pass, settings: r.settings }).details).toEqual(['The strategy probes were off, so a single winning strategy was not checked']);
    const warn = { ...pass, checks: [...pass.checks, { key: 'unused' as const, status: 'warn' as const, title: 'Nobody used "Let go"', detail: null, fix: null }] };
    expect(calibrationPublishCheck(warn)).toMatchObject({ status: 'advisory', blocking: false, details: ['Nobody used "Let go"'] });
    const fail = { ...pass, checks: [{ key: 'ordered' as const, status: 'fail' as const, title: 'Scores do not rise', detail: null, fix: null }] };
    expect(calibrationPublishCheck(fail)).toMatchObject({ status: 'failed', blocking: true, summary: '4 playthroughs at four levels. One check failed.' });
    expect(calibrationPublishCheck(pass, { draft: { ...raw, name: 'Changed' } })).toMatchObject({ status: 'outOfDate', action: 'Run the test again' });
    expect(calibrationPublishCheck(pass, { draft: raw }).status).toBe('passed');
  });
});
