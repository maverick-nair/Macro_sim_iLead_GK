import { beforeAll, describe, expect, it } from 'vitest';
import { wordAll as en } from '../../i18n/engineCopy';
import { msg } from '../copy';
import { parseStoryline, type StorylineConfig } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { playStrategy, STRATEGIES, type Strategy } from '../sim/strategies';
import { createSim } from '../sim/sim';
import type { Band, Sim } from '../sim/types';
import { DEFAULT_EVIDENCE } from './defaults';
import { gatherEvidence, strengths } from './evidence';
import { levelCaps, OUTCOME_GATES, reasonsOf } from './outcomes';
import { summarizeRun } from './summary';
import { buildGroupReport, summarizeBenchmark } from './group';
import type { ReportView } from '../reportContract';
import { buildReport } from './build';

/**
 * The overall level capped by what happened (D168), the verdict on it and the outcome gates (D169), and the
 * contradiction guard on the level tile and the verdict (D170), on the four contrasting scripted runs of the
 * report audit (`src/engine/sim/strategies.ts`), played as development and as assessment.
 */
const parse = (raw: unknown): StorylineConfig => { const p = parseStoryline(raw); if (!p.ok) throw new Error(p.issues.join('\n')); return p.config; };
const development = parse(salesElevator);
const assessment = parse({ ...salesElevator, purpose: 'assessment' });

type Rep = ReportView;
const dev = {} as Record<Strategy, Rep>, asmt = {} as Record<Strategy, Rep>;
beforeAll(async () => {
  for (const s of STRATEGIES) {
    dev[s] = en((await playStrategy(development, s, 1)).view.report!) as unknown as Rep;
    asmt[s] = en((await playStrategy(assessment, s, 1)).view.report!) as unknown as Rep;
  }
}, 120000);

const tile = (r: Rep) => ({ level: r.summary.level?.name ?? null, why: r.summary.levelCap?.why ?? null });
const verdict = (r: Rep) => ({ label: r.verdict!.overall.label, why: r.verdict!.overall.why });

describe('the overall level tile, capped by outcomes (D168)', () => {
  it('rates each run from its words, then holds it down by what happened, and says why', () => {
    expect(Object.fromEntries(STRATEGIES.map(s => [s, tile(dev[s])]))).toEqual({
      // Every choice fit, the target was met and nobody left: the words stand.
      coach: { level: 'Advanced', why: null },
      driver: { level: 'Developing', why: 'Rated Developing: your words rated Proficient, but 2 people left the team and team morale fell 39 points.' },
      // No conversations, so no level to cap.
      bystander: { level: null, why: null },
      warmMismatch: { level: 'Developing', why: 'Rated Developing: your words rated Role Model, but 6% of your style choices fit what people needed, 4 people left the team and revenue reached 49% of target.' }
    });
    expect(dev.warmMismatch.summary.levelCap).toMatchObject({ from: { index: 4, name: 'Role Model' }, gates: ['fit', 'people', 'business'] });
    expect(dev.warmMismatch.run.overall).toMatchObject({ level: 1, score: 59, words: { level: 4, score: 91.8 }, caps: ['fit', 'people', 'business'] });
  });

  it('words the reason neutrally in assessment', () => {
    expect(tile(asmt.warmMismatch).why).toBe('Rated Developing: the words in conversation rated Role Model, but 6% of the style choices fit what people needed, 4 people left the team and revenue reached 49% of target.');
    for (const s of STRATEGIES) expect(tile(asmt[s]).why ?? '').not.toMatch(/\byour?\b/i);
  });

  it('feeds the run summary, so the group report and the benchmark read the capped level', () => {
    for (const s of STRATEGIES) expect(dev[s].run.overall.level).toBe(dev[s].summary.level?.index ?? null);
  });
});

describe('assessment verdicts on the capped level and the outcome gates (D169)', () => {
  it('derives each verdict from the capped level and the outcomes, and says what held it', () => {
    expect(Object.fromEntries(STRATEGIES.map(s => [s, verdict(asmt[s])]))).toEqual({
      // Strong business and people outcomes, no gate: exceeds.
      coach: { label: 'Exceeds the bar', why: null },
      driver: { label: 'Below the bar', why: 'The words in conversation alone would approach the bar, but 2 people left the team, revenue reached 63% of target and team morale fell 39 points.' },
      bystander: { label: 'Not enough evidence for a verdict', why: null },
      warmMismatch: { label: 'Below the bar', why: 'The words in conversation alone would meet the bar, but 6% of the style choices fit what people needed, 4 people left the team and revenue reached 49% of target.' }
    });
  });

  it('keeps development reports free of verdicts', () => {
    for (const s of STRATEGIES) {
      expect(dev[s].verdict).toBeNull();
      expect(dev[s].run.verdict).toBeNull();
      expect(JSON.stringify(dev[s].summary)).not.toMatch(/the bar|verdict/i);
    }
  });

  it('reads its thresholds from the report config', async () => {
    // Looser gates: business only under 30%, people collapsed only with 9 leavers and big falls, fit only under 2%.
    const loose = parse({ ...salesElevator, purpose: 'assessment', report: { outcomes: {
      fit: { signals: ['styleFit'], caps: [{ below: 2, level: 1 }] },
      business: { caps: [{ below: 30, level: 1 }] },
      people: { weak: { moraleDrop: 90, trustDrop: 90, skillDrop: 90, left: 9, level: 2 }, collapsed: { moraleDrop: 95, trustDrop: 95, skillDrop: 95, left: 10, level: 1 } }
    } } });
    const r = en((await playStrategy(loose, 'warmMismatch', 1)).view.report!) as unknown as Rep;
    // No gate triggers, but the guard still holds a run the data calls weak at the middle of the scale (D170).
    expect(r.run.overall.caps).toEqual(['guard']);
    expect(r.summary.level?.name).toBe('Proficient');
    expect(r.summary.levelCap!.why).toBe('Rated Proficient: the words in conversation rated Role Model, but 6% of the style choices fit what people needed, 4 people left the team and revenue reached 49% of target.');
    // Meets needs no weak core dimension: the guard refuses it.
    expect(r.verdict!.overall.key).toBe('approaching');
  });
});

/** Praise in words, and the evidence that would contradict it. */
const PRAISE: Array<{ words: RegExp; dimension: 'styleFit' | 'business' | 'people' }> = [
  { dimension: 'styleFit', words: /adapt|read people well|fit what people needed most/i },
  { dimension: 'business', words: /numbers followed|hit the numbers|target was met|strong business/i },
  { dimension: 'people', words: /team grew|strong with people|care and clarity/i }
];

describe('the contradiction guard on the tile and the verdict (D170)', () => {
  it('never shows a level above the middle, or a verdict that meets the bar, over a dimension the data calls weak', () => {
    for (const [purpose, runs] of [['development', dev], ['assessment', asmt]] as const) {
      for (const s of STRATEGIES) {
        const r = runs[s];
        const t = r.run.objectives.team;
        const weak = {
          business: r.run.objectives.share < DEFAULT_EVIDENCE.business.weak,
          styleFit: r.run.styles.total > 0 && r.run.styles.adaptability < DEFAULT_EVIDENCE.styleFit.weak,
          people: t.morale.end - t.morale.start <= -DEFAULT_EVIDENCE.people.moraleDrop || r.people.some(p => p.left)
        };
        const anyWeak = Object.values(weak).some(Boolean);
        if (r.summary.level && r.summary.level.index > 2) expect(anyWeak, `${purpose} ${s} tile ${r.summary.level.name}`).toBe(false);
        if (r.verdict && ['exceeds', 'meets'].includes(r.verdict.overall.key ?? '')) expect(anyWeak, `${purpose} ${s} ${r.verdict.overall.label}`).toBe(false);
        // The lines that explain a cap state facts; they never praise a dimension the data calls weak.
        const text = [r.summary.levelCap?.why ?? '', r.verdict?.overall.why ?? ''].join(' ');
        for (const p of PRAISE) if (weak[p.dimension]) expect(text, `${purpose} ${s}`).not.toMatch(p.words);
      }
    }
  });

  it('holds the authored level line to the capped level', () => {
    // Role Model words with the wrong styles no longer read as the best leaders (D143), and the tile agrees.
    expect(dev.warmMismatch.summary.narrative ?? '').not.toMatch(/the best leaders/);
    expect(dev.warmMismatch.summary.level?.name).not.toBe('Role Model');
  });
});

// ---------------------------------------------------------------- the people outcome, from everyone (D170)

describe('people outcomes count everyone who was on the team', () => {
  const sim0 = () => createSim(development, 1);
  const leave = (sim: Sim, i: number, morale: number) => {
    const m = sim.members[i];
    m.morale = morale;
    sim.members = sim.members.filter(x => x !== m);
    sim.departed.push(m);
    return m;
  };

  it('reads a leaver at their last values, so a team that shrank does not look healthy', () => {
    const sim = sim0();
    const start = sim.members[0].morale;
    leave(sim, 0, 0);
    const e = gatherEvidence(sim, summarizeRun(sim));
    // The team average of who is left did not move; everyone who was on the team did.
    expect(e.change.morale).toBe(0);
    expect(e.everyone!.morale).toBeCloseTo(-start / (sim.members.length + 1), 5);
    expect(e.departed).toBe(1);
    expect(strengths(e, development.report.evidence).people).toBe('weak');
  });

  it('counts every leaver for the people gates, resigned or let go, and resignations from people dynamics', () => {
    const sim = sim0();
    leave(sim, 0, 40);
    expect(levelCaps(sim, gatherEvidence(sim, summarizeRun(sim))).find(c => c.gate === 'people')).toMatchObject({ level: 2, reasons: [{ kind: 'left', n: 1 }] });
    leave(sim, 0, 40);
    expect(levelCaps(sim, gatherEvidence(sim, summarizeRun(sim))).find(c => c.gate === 'people')).toMatchObject({ level: 1, reasons: [{ kind: 'left', n: 2 }] });
    // A resignation after weeks of low morale (D135) is a resignation for D143's evidence too.
    sim.log.push({ id: 'l1', period: 1, sub: 1, kind: 'trigger', title: msg('engine.dyn.resigned.label'), memberIds: [], changes: [] } as unknown as Sim['log'][number]);
    expect(gatherEvidence(sim, summarizeRun(sim)).resigned).toBe(1);
  });

  it('holds a skill with a harmful conversation, and the overall level, to what is shown', () => {
    const sim = sim0();
    const keys = development.report.skills.map(s => s.key);
    const rec = (key: string, band: Band, i: number) => sim.liveRecords.push({ id: `h${key}${i}`, period: 1, sub: i, actionKey: 'f2f', format: 'roleplay', band, memberIds: ['kent'], title: 'Meet', skills: [{ key, band, evidence: [] }], quotes: [] });
    for (const k of keys.slice(0, 4)) for (let i = 0; i < 4; i++) rec(k, 'strong', i);
    rec(keys[0], 'harmful', 9);
    sim.funnel.value = development.money.target;
    const run = summarizeRun(sim);
    // Three skills at 100, one held at 59: the words average 89.75, Advanced, not the 94 the unheld score would give.
    expect(run.skills[0]).toMatchObject({ score: 59, level: 1 });
    expect(run.overall.words).toEqual({ score: 89.75, level: 3 });
  });
});

describe('reasons', () => {
  it('tells one fact per cap first, lowest cap first, then the rest, at most three', () => {
    const caps = [
      { gate: 'business' as const, level: 2, reasons: [{ kind: 'revenue' as const, pct: 70 }] },
      { gate: 'people' as const, level: 1, reasons: [{ kind: 'left' as const, n: 2 }, { kind: 'morale' as const, n: 30 }] },
      { gate: 'fit' as const, level: 1, reasons: [{ kind: 'styleFit' as const, pct: 3 }, { kind: 'diagnosis' as const, pct: 0 }] }
    ];
    expect(reasonsOf(caps).map(r => r.kind)).toEqual(['styleFit', 'left', 'revenue']);
    expect(reasonsOf(caps.slice(1, 2)).map(r => r.kind)).toEqual(['left', 'morale']);
    expect(OUTCOME_GATES).toEqual(['business', 'people', 'stakeholders', 'decisions']);
  });
});

// ---------------------------------------------------------------- the group report

describe('the group report aggregates the capped levels and verdicts', () => {
  it('counts the runs the outcomes held down, by gate, and marks them in the participant table', async () => {
    const runs = STRATEGIES.map(s => asmt[s].run);
    const b = summarizeBenchmark(runs);
    expect(b.overall.levels).toEqual([0, 2, 0, 1]);
    expect(b.overall.capped).toEqual({ count: 2, gates: { fit: 1, people: 2, business: 1 } });
    expect(b.verdicts!.counts).toEqual({ exceeds: 1, meets: 0, approaching: 0, below: 2, none: 1 });
    const g = en(buildGroupReport({ runs, names: ['Coach', 'Driver', 'Bystander', 'Warm'], cohort: { name: 'Audit', date: '2026-10-08', purpose: 'assessment', storyline: assessment } }));
    expect(g.capped).toBe('Outcomes held the overall level under what the words reached for 2 of 4 participants: people outcomes for 2, style fit for 1 and business results for 1.');
    expect(g.assessment!.participants.map(p => [p.name, p.level, p.label])).toEqual([
      ['Bystander', null, 'Not enough evidence for a verdict'],
      ['Coach', 'Advanced', 'Exceeds the bar'],
      ['Driver', 'Developing, held by outcomes', 'Below the bar'],
      ['Warm', 'Developing, held by outcomes', 'Below the bar']
    ]);
    expect(g.assessment!.narrative).toMatch(/^1 of 4/);
  });

  it('shows the count in development only for a cohort large enough, with no verdicts or names', () => {
    const runs = STRATEGIES.map(s => dev[s].run);
    const small = en(buildGroupReport({ runs, cohort: { name: 'Audit', date: '2026-10-08', purpose: 'development', storyline: development } }));
    expect(small.capped).toBeNull();
    const big = en(buildGroupReport({ runs: [...runs, ...runs], cohort: { name: 'Audit', date: '2026-10-08', purpose: 'development', storyline: development } }));
    expect(big.capped).toBe('Outcomes held the overall level under what the words reached for 4 of 8 participants: people outcomes for 4, style fit for 2 and business results for 2.');
    expect(JSON.stringify(big)).not.toMatch(/the bar|Driver/);
  });

  it('builds the same capped level through the report as through the summary', () => {
    const sim = createSim(development, 1);
    expect(buildReport(sim).run.overall).toEqual(summarizeRun(sim).overall);
  });
});
