import { describe, expect, it } from 'vitest';
import raw from '../../../engine/storylines/sales-elevator.json';
import type { Copy } from '../../../engine/copy';
import type { Evaluation } from '../../../engine/sim/types';
import { copyViolations } from '../../../i18n/copy';
import { toStoryline } from '../../model/export';
import { freshDraft } from '../../model/store';
import { changedActions, playsBundledActions } from './bundled';
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
    // Three seeds for each style alone and with team energy, two for each action, as many actions as possible,
    // reading without acting and six pairs of actions (D149), and two each with every conversation Strong, then Weak (D132).
    const kinds = (k: string) => results.probes.filter(p => p.probe?.kind === k).length;
    expect([kinds('style'), kinds('action'), kinds('energize'), kinds('busy'), kinds('idle'), kinds('pair'), kinds('band')]).toEqual([12, 2 * raw.actions.length, 12, 2, 2, 12, 4]);
    expect(results.probes.filter(p => p.probe?.kind === 'band').map(p => p.probe!.key)).toEqual(['strong', 'strong', 'weak', 'weak']);
    expect(results.probes.filter(p => p.probe?.kind === 'pair').every(p => p.persona === 'expert' && p.probe!.key.split('+').length === 2)).toBe(true);
    // Each run says where its points came from and how often its words were read as meant.
    expect(results.runs.every(r => r.pillars && r.styleRead && r.styleRead.read <= r.styleRead.meant)).toBe(true);
    expect(results.personas.every(p => p.sd !== undefined && p.pillars && p.styleRead !== null)).toBe(true);
    expect(results.checks.find(c => c.key === 'unused')).toMatchObject({ status: 'pass', detail: '"Hire member" and "Let go" are rare by design and not counted.' });
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
  }, 30_000);

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
    const { runs, probes, pairs, bands } = checkedPlan(config, s);
    expect(probes.filter(p => p.probe.kind === 'action')).toHaveLength(2 * MAX_PROBE_ACTIONS);
    expect(runs.length + probes.length + pairs + bands.length).toBeLessThanOrEqual(MAX_PLAYTHROUGHS);
  });

  it('plans seeds per persona, so every persona meets the same team', () => {
    const { runs, probes } = plan(parseDraft(raw), CalibrationSettings.parse({ personas: { beginner: 2, expert: 2 }, seed: 5, probes: false }));
    expect(runs.map(r => `${r.persona}:${r.seed}`)).toEqual(['beginner:5', 'beginner:6', 'expert:5', 'expert:6']);
    expect(probes).toEqual([]);
  });
});

/** Sales Elevator with its lens written out, to break on purpose. */
function broken(change: (c: ReturnType<typeof parseDraft>) => void) {
  const c = structuredClone(parseDraft(raw));
  change(c);
  return c;
}
const small = { personas: { beginner: 2, developing: 2, proficient: 2, expert: 2 }, seed: 1 };
const statusOf = async (draft: unknown, probes = true) => {
  const { results } = await runCalibration(draft, { ...small, probes }, { ranOn: 'cli', yieldEvery: async () => undefined });
  return Object.fromEntries(results.checks.map(c => [c.key, c.status]));
};

describe('checks that catch broken configs (D132)', () => {
  it('a flat fit table, or one where one style fits every need, fails: styles do not change the outcome', async () => {
    const flat = broken(c => { for (const n of Object.keys(c.lens.fit) as Array<keyof typeof c.lens.fit>) for (const k of Object.keys(c.lens.fit[n])) c.lens.fit[n][k] = 0; });
    expect((await statusOf(flat)).styleEffect).toBe('fail');
    const scrambled = broken(c => { for (const n of Object.keys(c.lens.fit) as Array<keyof typeof c.lens.fit>) c.lens.fit[n] = { D: 0, G: 2, P: 1, E: 2 }; });
    expect((await statusOf(scrambled)).styleEffect).toBe('fail');
  }, 30_000);

  it('conversations with zero effect fail: every one Strong does no more than every one Weak', async () => {
    const zero = [0, 0, 0, 0] as [number, number, number, number];
    const flatTalk = broken(c => { for (const a of c.actions) if (a.kind !== 'static') a.live = { ...a.live, consequences: { strong: { target: zero, sponsor: 0 }, adequate: { target: zero, sponsor: 0 }, weak: { target: zero, sponsor: 0 }, harmful: { target: zero, sponsor: 0 } } }; });
    expect((await statusOf(flatTalk)).conversationEffect).toBe('fail');
  }, 30_000);

  it('a revenue target cut to a tenth, or set to 1e12, fails', async () => {
    expect((await statusOf(broken(c => { c.money.target = c.money.target / 10; }), false)).target).toBe('fail');
    expect((await statusOf(broken(c => { c.money.target = 1e12; }), false)).target).toBe('fail');
  }, 30_000);
});

describe('checks that catch broken configs (D149, D150)', () => {
  const run = async (draft: unknown, personas: Record<string, number> = { expert: 2 }) => (await runCalibration(draft, { personas, seed: 1 }, { ranOn: 'cli', yieldEvery: async () => undefined })).results;
  const check = (r: Awaited<ReturnType<typeof run>>, key: string) => r.checks.find(c => c.key === key);

  it('team energy that dominates fails the combined check: a routine beats judgement', async () => {
    const energize = broken(c => {
      c.id = 'energize_dominance';
      for (const o of c.actions.find(a => a.key === 'energize')!.options) { o.effects = { m0: [8, 25, 30], m1: [8, 25, 30], m2: [8, 25, 30] }; o.cooldownDays = 0; }
    });
    const r = await run(energize);
    expect(check(r, 'combined')).toMatchObject({ status: 'fail' });
    expect(check(r, 'combined')?.title).toMatch(/^A routine wins over judgement: .*(Energize the team|Team energy every week)/);
  }, 60_000);

  it('a storyline where reading people alone reaches Gold warns: do nothing after diagnosis', async () => {
    const heavy = broken(c => { c.id = 'do_nothing_gold'; c.gamification.weights = { business: 0.1, people: 0.1, leadership: 0.8 }; });
    expect(check(await run(heavy), 'idle')).toMatchObject({ status: 'warn', title: expect.stringMatching(/^Reading people right without taking any action reaches Gold/) });
    const light = broken(c => { c.id = 'acting_counts'; c.gamification.weights = { business: 0.45, people: 0.45, leadership: 0.1 }; });
    expect(check(await run(light), 'idle')).toMatchObject({ status: 'pass' });
  }, 60_000);

  it('Sales Elevator: the combined finding is advice on the bundled actions, and a failure once an author changes what they do', async () => {
    const r = await run(raw, { expert: 3, peopleFirst: 2 });
    expect(check(r, 'combined')).toMatchObject({ status: 'warn', detail: expect.stringMatching(/^A finding in the bundled Sales Elevator's calibrated actions/) });
    // People first beats the Expert on score and revenue: no trade-off between people and results.
    expect(check(r, 'tradeOff')).toMatchObject({ status: 'warn' });
    // A draft keeps the bundled actions under its own id and wording: still advice.
    expect(playsBundledActions(parseDraft({ ...raw, id: 'draft_acme', actions: raw.actions.map(a => ({ ...a, name: `${a.name} now` })) }))).toBe(true);
    // A fresh /author draft plays them too (its actions switched off do not count), until the author changes one.
    const fresh = parseDraft(toStoryline(freshDraft()).storyline);
    expect(changedActions(fresh)).toEqual([]);
    expect(playsBundledActions(fresh)).toBe(true);
    const changed = broken(c => { c.id = 'draft_sales_copy'; c.actions.find(a => a.key === 'reward')!.cost = 2; });
    expect(changedActions(changed)).toEqual(['reward']);
    expect(playsBundledActions(changed)).toBe(false);
    expect(check(await run(changed, { expert: 3 }), 'combined')).toMatchObject({ status: 'fail' });
  }, 60_000);
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
    expect(calibrationPublishCheck(pass)).toEqual({ key: 'syntheticPlayers', title: 'Synthetic players', status: 'passed', blocking: false, summary: '4 playthroughs at four levels: scores rise with proficiency, Experts reach the target, Beginners do not.', details: [], action: 'See results', full: true });
    // A run that left levels out, or had the probes off, is not a full test: advisory, whatever its checks say.
    const partial = { ...pass, personas: r.personas, settings: r.settings };
    expect(calibrationPublishCheck(partial)).toMatchObject({
      status: 'advisory', blocking: false, full: false, action: 'Run the test again',
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
