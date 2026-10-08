import { beforeAll, describe, expect, it } from 'vitest';
import { wordAll as en } from '../../i18n/engineCopy';
import { DEFAULT_EVIDENCE } from './defaults';
import { parseStoryline, type StorylineConfig } from '../config';
import { ReportProfile, ReportView } from '../reportContract';
import salesElevator from '../storylines/sales-elevator.json';
import { playStrategy, STRATEGIES, type Strategy } from '../sim/strategies';
import { createSim, netChanges } from '../sim/sim';
import type { Band, Sim } from '../sim/types';
import { buildReport } from './build';
import { classify, contradicts, guard, PROFILES, strengths, type Evidence } from './evidence';

/**
 * The report's narrative from the evidence (D143 to D145), on four contrasting scripted runs from the
 * report audit: a people first coach, a results driver, a player who reads people and then does
 * nothing, and warm words with the wrong styles.
 */
const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config: StorylineConfig = parsed.config;
const assessment = (() => { const c = parseStoryline({ ...salesElevator, purpose: 'assessment' }); if (!c.ok) throw new Error(c.issues.join()); return c.config; })();

type Rep = ReturnType<typeof en<NonNullable<Awaited<ReturnType<typeof playStrategy>>['view']['report']>>> & ReportView;
const runs = {} as Record<Strategy, Rep>;
beforeAll(async () => {
  for (const s of STRATEGIES) runs[s] = en((await playStrategy(config, s, 1)).view.report!) as unknown as Rep;
}, 60000);

const T = DEFAULT_EVIDENCE;
/** What a report says about the run: its headline, summary lines and the authored level line. */
const said = (r: Rep) => [r.summary.headline ?? '', ...r.summary.lines, r.summary.narrative ?? ''].join(' ');
/**
 * Praise found in the words, against the numbers that would contradict it: a sentence that praises a
 * dimension must not appear when its metric is below the weak threshold.
 */
const PRAISE: Array<{ words: RegExp; ok: (r: Rep) => boolean; what: string }> = [
  { what: 'style fit', words: /adapt to what they need|read people well|you read people|fit what people needed most/i, ok: r => r.run.styles.adaptability >= T.styleFit.weak },
  { what: 'business', words: /numbers followed|hit the numbers|bring the numbers|target was met/i, ok: r => r.run.objectives.share >= T.business.weak },
  { what: 'people', words: /team grew|strong with people|lead people well|care and clarity/i, ok: r => {
    const t = r.run.objectives.team;
    return t.morale.end - t.morale.start > -T.people.moraleDrop && t.trust.end - t.trust.start > -T.people.trustDrop && !r.people.some(p => p.left);
  } }
];

describe('four contrasting runs (D143)', () => {
  it('each gets its own profile and headline', () => {
    expect(Object.fromEntries(STRATEGIES.map(s => [s, runs[s].summary.profile]))).toEqual({
      coach: 'allRound', driver: 'bothSlipped', bystander: 'readNoAction', warmMismatch: 'wordsNotChoices'
    });
    const headlines = STRATEGIES.map(s => runs[s].summary.headline);
    expect(new Set(headlines).size).toBe(4);
    expect(runs.coach.summary.headline).toBe('Your team grew and the numbers followed.');
    expect(runs.driver.summary.headline).toBe('The team and the numbers both slipped.');
    expect(runs.bystander.summary.headline).toBe('You read people well but rarely acted.');
    expect(runs.warmMismatch.summary.headline).toBe('Your words and your choices did not match.');
  });

  it('never praises a dimension its numbers contradict', () => {
    for (const s of STRATEGIES) {
      const r = runs[s];
      for (const p of PRAISE) if (p.words.test(said(r))) expect(p.ok(r), `${s} praises ${p.what}: ${said(r)}`).toBe(true);
    }
    // The audit's three: warm words with wrong styles, the driver, and reading people then doing nothing.
    expect(said(runs.warmMismatch)).not.toMatch(/you read people, adapt|the best leaders/);
    expect(said(runs.driver)).not.toMatch(/care and clarity/);
    expect(runs.bystander.summary.lines.join(' ')).toMatch(/You took no actions in 8 weeks/);
  });

  it('states the numbers behind the summary', () => {
    expect(runs.coach.summary.lines[0]).toMatch(/^Over the run your team's averages moved: trust \+\d+/);
    expect(runs.warmMismatch.summary.lines.join(' ')).toContain(`${Math.round(runs.warmMismatch.run.styles.adaptability)}% of your style choices fit`);
    expect(runs.driver.summary.lines.join(' ')).toMatch(/You chose Directing for \d+ of \d+ style choices/);
    // Development closes with the next step for the profile; assessment states findings only (D75).
    expect(STRATEGIES.map(s => runs[s].summary.lines.at(-1)).every(l => l!.startsWith('Next step: '))).toBe(true);
  });

  it('words assessment reports neutrally, without a next step', async () => {
    const r = en((await playStrategy(assessment, 'warmMismatch', 1)).view.report!);
    expect(r.summary.headline).toBe('The words in conversation and the style choices did not match.');
    expect(r.summary.lines.some(l => l.startsWith('Next step'))).toBe(false);
    expect([...r.summary.lines, ...r.summary.drivers.map(d => d.text)].join(' ')).not.toMatch(/\byour?\b/i);
  });
});

describe('the contradiction guard', () => {
  const base: Evidence = {
    share: 100, change: { skill: 6, morale: 0, result: 6, trust: 6 }, resigned: 0, departed: 0, styleFit: 80, diagnosis: 80, words: 80,
    conversations: 10, landed: 9, actions: 24, breadth: 4, periods: 8, sponsor: { start: 50, end: 60 }, missed: 0, answered: 2
  };
  it('refuses praise of a dimension below its weak threshold, and criticism of one at its strong threshold', () => {
    expect(contradicts({ dimension: 'styleFit', tone: 'positive' }, { ...base, styleFit: 31 }, T)).toBe(true);
    expect(contradicts({ dimension: 'styleFit', tone: 'positive' }, { ...base, styleFit: 40 }, T)).toBe(false);
    expect(contradicts({ dimension: 'business', tone: 'positive' }, { ...base, share: 58 }, T)).toBe(true);
    expect(contradicts({ dimension: 'people', tone: 'positive' }, { ...base, change: { ...base.change, morale: -10 } }, T)).toBe(true);
    expect(contradicts({ dimension: 'people', tone: 'positive' }, { ...base, resigned: 1 }, T)).toBe(true);
    expect(contradicts({ dimension: 'activity', tone: 'negative' }, base, T)).toBe(true);
    expect(contradicts({ dimension: 'activity', tone: 'negative' }, { ...base, actions: 0 }, T)).toBe(false);
    // No evidence: only neutral claims.
    expect(contradicts({ dimension: 'words', tone: 'positive' }, { ...base, words: null }, T)).toBe(true);
    expect(contradicts({ dimension: 'words', tone: 'neutral' }, { ...base, words: null }, T)).toBe(false);
    expect(guard([{ dimension: 'styleFit', tone: 'positive', text: 'a' }, { dimension: 'styleFit', tone: 'negative', text: 'b' }], { ...base, styleFit: 20 }, T).map(c => c.text)).toEqual(['b']);
  });

  it('picks the profile from several signals, never the level', () => {
    expect(classify(base, T)).toBe('allRound');
    expect(classify({ ...base, share: 58, styleFit: 31, words: 85 }, T)).toBe('wordsNotChoices');
    expect(classify({ ...base, actions: 0, conversations: 0, words: null }, T)).toBe('readNoAction');
    expect(classify({ ...base, actions: 2, styleFit: 30, words: null }, T)).toBe('absent');
    expect(classify({ ...base, change: { ...base.change, morale: -20 } }, T)).toBe('numbersAtCost');
    expect(classify({ ...base, share: 70 }, T)).toBe('peopleFirst');
    expect(classify({ ...base, share: 70, change: { ...base.change, morale: -20 } }, T)).toBe('bothSlipped');
    expect(classify({ ...base, share: 90, change: { skill: 0, morale: 0, result: 0, trust: 0 } }, T)).toBe('mixed');
    expect(strengths({ ...base, missed: 2 }, T).events).toBe('weak');
  });

  it('names the same profiles as the report contract', () => {
    expect([...PROFILES]).toEqual(ReportProfile.options);
  });
});

let n = 0;
const rec = (sim: Sim, key: string, band: Band) => sim.liveRecords.push({ id: `r${++n}`, period: 1, sub: 1, actionKey: 'f2f', format: 'roleplay', band, memberIds: ['kent'], title: 'Meet face to face', skills: [{ key, band, evidence: [] }], quotes: [] });
const decide = (sim: Sim, fits: number, misses: number) => {
  for (let i = 0; i < fits + misses; i++) sim.decisions.run.push({ memberId: 'kent', chosen: 'D', need: 'lowSkill_lowMorale', mismatch: i < fits ? 0 : 2, source: 'weeklyStyle', period: 1 });
};

describe('ratings reconciled with behaviour (D144)', () => {
  it('caps a skill about adapting by the share of style choices that fit, and says why', () => {
    const sim = createSim(config, 1);
    for (let i = 0; i < 3; i++) rec(sim, 'situational_flexibility', 'strong');
    decide(sim, 31, 69);
    const s = en(buildReport(sim)).skills.find(x => x.key === 'situational_flexibility')!;
    expect(s.level?.name).toBe('Developing');
    expect(s.score).toBe(59);
    expect(s.reconciled).toEqual({ signal: 'styleFit', pct: 31, from: 4 });
    expect(s.reconciliation).toBe('Your words in conversation rated Role Model, but your style choices fit what people needed 31% of the time, so this is rated Developing.');
  });

  it('caps at Proficient under 70%, leaves 70% and up alone, and leaves other skills to the words', () => {
    const sim = createSim(config, 1);
    for (let i = 0; i < 3; i++) { rec(sim, 'situational_flexibility', 'strong'); rec(sim, 'coaching_for_growth', 'strong'); }
    decide(sim, 60, 40);
    const r = en(buildReport(sim));
    expect(r.skills.find(x => x.key === 'situational_flexibility')!.level?.name).toBe('Proficient');
    expect(r.skills.find(x => x.key === 'coaching_for_growth')!).toMatchObject({ level: { name: 'Role Model' }, reconciled: null, reconciliation: null });
    const fine = createSim(config, 1);
    for (let i = 0; i < 3; i++) rec(fine, 'situational_flexibility', 'strong');
    decide(fine, 7, 3);
    expect(en(buildReport(fine)).skills.find(x => x.key === 'situational_flexibility')!).toMatchObject({ level: { name: 'Role Model' }, reconciled: null });
  });

  it('is configurable per skill', () => {
    const c = parseStoryline({ ...salesElevator, report: { reconcile: { skills: { coaching_for_growth: ['diagnosis'] }, caps: [{ below: 50, level: 0 }] } } });
    if (!c.ok) throw new Error(c.issues.join());
    const sim = createSim(c.config, 1);
    for (let i = 0; i < 3; i++) { rec(sim, 'situational_flexibility', 'strong'); rec(sim, 'coaching_for_growth', 'strong'); }
    decide(sim, 2, 8);
    const r = en(buildReport(sim));
    expect(r.skills.find(x => x.key === 'situational_flexibility')!.reconciled).toBeNull();
    expect(r.skills.find(x => x.key === 'coaching_for_growth')!).toMatchObject({ level: { name: 'Novice' }, reconciled: { signal: 'diagnosis', pct: 20 } });
  });

  it('rates the warm words, wrong styles run Developing at most, and the coach as the words say', () => {
    const sf = (s: Strategy) => runs[s].skills.find(x => x.key === 'situational_flexibility')!;
    expect(sf('warmMismatch').level!.index).toBeLessThanOrEqual(1);
    expect(sf('warmMismatch').reconciliation).toMatch(/fit what people needed \d+% of the time, so this is rated Developing\.$/);
    expect(sf('coach').reconciled).toBeNull();
  });
});

describe('what drove the results (D145)', () => {
  it('names 3 to 5 decisions or patterns with their numbers, the same each time', async () => {
    for (const s of STRATEGIES) {
      const d = runs[s].summary.drivers;
      expect(d.length, s).toBeGreaterThanOrEqual(3);
      expect(d.length, s).toBeLessThanOrEqual(5);
      expect(d.every(x => /\d/.test(x.text)), s).toBe(true);
    }
    const again = en((await playStrategy(config, 'coach', 1)).view.report!);
    expect(again.summary.drivers).toEqual(runs.coach.summary.drivers);
  });

  it('links a person and the weeks to what changed', () => {
    expect(runs.coach.summary.drivers.map(d => d.text).join(' ')).toMatch(/Coach member with (\w+) in weeks? [\d, and]+ lifted \1's (result|skill|morale) by \d+/);
    expect(runs.bystander.summary.drivers.map(d => d.key)).toEqual(expect.arrayContaining(['unanswered', 'escalated']));
    expect(runs.warmMismatch.summary.drivers.find(d => d.key === 'style:miss')?.text).toMatch(/^\d+ of your \d+ weekly style choices missed what people needed/);
    expect(runs.driver.summary.drivers.find(d => d.key === 'bottleneck')?.text).toMatch(/was the bottleneck in \d of 8 weeks: \w+, who owns it, ended with/);
  });
});

describe('reflections and takeaways (D145)', () => {
  it('differ by profile and name what happened in the run', () => {
    const qs = STRATEGIES.map(s => runs[s].thought.map(q => q.question).join('|'));
    expect(new Set(qs).size).toBe(4);
    const tk = STRATEGIES.map(s => runs[s].takeaways.join('|'));
    expect(new Set(tk).size).toBe(4);
    const names = config.members.map(m => m.name.split(' ')[0]);
    for (const s of STRATEGIES) {
      const first = runs[s].thought[0].question;
      expect(names.some(n => first.includes(n)) || /\bweeks? \d|\d+ weeks?\b|\d+%/.test(first), `${s}: ${first}`).toBe(true);
    }
    expect(runs.bystander.thought[0].question).toBe('You set a style for every person each week and took no actions in 8 weeks. What stopped you from acting on what you saw?');
    expect(runs.bystander.thought.map(q => q.question).join(' ')).toMatch(/message in week \d went unanswered/);
    expect(runs.warmMismatch.thought[0].question).toMatch(/^\d+ of your \d+ conversations went well or landed, yet \d+% of your style choices fit/);
  });

  it('keep the authored questions after the run specific ones', () => {
    for (const s of STRATEGIES) {
      expect(runs[s].thought.length).toBeGreaterThanOrEqual(4);
      expect(runs[s].thought.at(-1)!.question).toBe(config.report.thought[0].question);
    }
  });
});

describe('impact lines and pronouns (D145)', () => {
  it('merge changes to the same person and metric', () => {
    expect(netChanges([{ subject: 'peter', metric: 'trust', delta: 3 }, { subject: 'peter', metric: 'trust', delta: -3 }, { subject: 'peter', metric: 'morale', delta: -1 }]))
      .toEqual([{ subject: 'peter', metric: 'morale', delta: -1 }]);
    expect(netChanges([{ subject: 'jack', metric: 'morale', delta: 4 }, { subject: 'jack', metric: 'trust', delta: 3 }, { subject: 'jack', metric: 'morale', delta: 3 }]))
      .toEqual([{ subject: 'jack', metric: 'morale', delta: 7 }, { subject: 'jack', metric: 'trust', delta: 3 }]);
    for (const s of STRATEGIES) for (const m of runs[s].moments) {
      const pairs = m.impact.replace(/\.$/, '').split(', ').map(x => x.replace(/ [+−]\d+$/, ''));
      expect(new Set(pairs).size, `${s}: ${m.impact}`).toBe(pairs.length);
    }
  });

  it("use the person's own pronoun, and they for anyone else", () => {
    const sim = createSim(config, 1);
    const beth = sim.members.find(m => m.id === 'beth')!;
    const others = sim.members.filter(m => m.stage === beth.stage && m !== beth);
    for (const m of others) m.result = 99;
    beth.result = 1;
    sim.periods.push({ ...({} as Sim['periods'][number]), period: 1, bottleneck: beth.stage, funnel: [], kpis: { skill: { start: 0, end: 0 }, morale: { start: 0, end: 0 }, result: { start: 0, end: 0 }, trust: { start: 0, end: 0 } }, cumulativeValue: 0, sponsor: { from: 50, to: 50, fromLevel: 'steady', toLevel: 'steady' } });
    expect(en(buildReport(sim)).business.bottleneck?.why).toMatch(/^Beth owns the stage .* the weakest of her numbers\.$/);
    const they = parseStoryline({ ...salesElevator, members: salesElevator.members.map(m => (m.id === 'beth' ? { ...m, pronoun: 'they' } : m)) });
    if (!they.ok) throw new Error(they.issues.join());
    const sim2 = createSim(they.config, 1);
    Object.assign(sim2, { members: sim2.members.map(m => (m.id === 'beth' ? { ...m, result: 1 } : m.stage === beth.stage ? { ...m, result: 99 } : m)), periods: sim.periods });
    expect(en(buildReport(sim2)).business.bottleneck?.why).toMatch(/the weakest of their numbers\.$/);
  });
});
