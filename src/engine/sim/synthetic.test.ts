import { describe, expect, it } from 'vitest';
import raw from '../storylines/sales-elevator.json';
import { parseStoryline, type StorylineConfig, type StorylineInput } from '../config';
import { withSixStyles } from '../storylines/sixStyles';
import { copyViolations } from '../../i18n/copy';
import { heuristicEvaluator } from './evaluator';
import { PERSONA_COPY, PERSONAS, playSynthetic, type PersonaKey, type SyntheticRun } from './synthetic';
import { lineFor, planFields, script, templateSpeaker, type Level, type SpeakerContext } from './syntheticSpeech';
import type { Evaluation } from './types';

const parse = (input: unknown): StorylineConfig => {
  const p = parseStoryline(input);
  if (!p.ok) throw new Error(p.issues.join('\n'));
  return p.config;
};
const RBL = parse(raw);
/** Six Leadership Styles without Pace Setter: a lens of five styles, as the merged lens will have (D110). */
function fiveStyles(): StorylineConfig {
  const six = withSixStyles(raw as unknown as StorylineInput) as StorylineInput & { lens: { styles: Array<{ key: string }>; fit: Record<string, Record<string, number>> } };
  six.lens.styles = six.lens.styles.filter(s => s.key !== 'pace');
  for (const row of Object.values(six.lens.fit)) delete row.pace;
  return parse({ ...six, id: 'sales-elevator-five' });
}
const FIVE = fiveStyles();

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
async function many(config: StorylineConfig, persona: PersonaKey, n: number): Promise<SyntheticRun[]> {
  const out: SyntheticRun[] = [];
  for (let i = 0; i < n; i++) out.push(await playSynthetic(config, persona, 11 + i));
  return out;
}

describe('synthetic players', () => {
  it('replay exactly for a seed and vary between seeds', async () => {
    const a = await playSynthetic(RBL, 'developing', 7);
    const b = await playSynthetic(RBL, 'developing', 7);
    expect(b.summary).toEqual(a.summary);
    expect(b.conversations.map(c => c.turns)).toEqual(a.conversations.map(c => c.turns));
    const c = await playSynthetic(RBL, 'developing', 8);
    expect(c.weeks.map(w => w.styles)).not.toEqual(a.weeks.map(w => w.styles));
  });

  it.each([['Readiness Based Leadership, four styles', RBL], ['a lens of five styles', FIVE]] as const)('rise with proficiency on %s', async (_, config) => {
    const scores: Record<PersonaKey, number> = { beginner: 0, developing: 0, proficient: 0, expert: 0 };
    for (const p of PERSONAS) scores[p] = mean((await many(config, p, 3)).map(r => r.summary.score.total));
    expect(scores.beginner).toBeLessThan(scores.developing);
    expect(scores.developing).toBeLessThan(scores.proficient);
    expect(scores.proficient).toBeLessThan(scores.expert);
    // The target tier (Gold, 700): Experts reach it, Beginners do not.
    expect(scores.expert).toBeGreaterThanOrEqual(700);
    expect(scores.beginner).toBeLessThan(700);
  });

  it('read styles from the lens: every style set and shown is one of its keys', async () => {
    const keys = new Set(FIVE.lens.styles.map(s => s.key));
    const run = await playSynthetic(FIVE, 'expert', 3);
    for (const w of run.weeks) for (const s of Object.values(w.styles)) expect(keys.has(s)).toBe(true);
    for (const c of run.conversations) if (c.evaluation) expect(keys.has(c.evaluation.styleUsed)).toBe(true);
    expect(run.summary.lens.styles).toEqual([...keys]);
  });

  it('play their level: the Beginner leans on one style and ignores events, the Expert adapts, answers and surfaces concerns', async () => {
    const [beginner, expert] = [await many(RBL, 'beginner', 3), await many(RBL, 'expert', 3)];
    // One default style for most people.
    for (const r of beginner) {
      const all = r.weeks.flatMap(w => Object.values(w.styles));
      const top = Math.max(...[...new Set(all)].map(s => all.filter(x => x === s).length));
      expect(top / all.length).toBeGreaterThan(0.6);
    }
    expect(mean(beginner.map(r => r.summary.styles.adaptability))).toBeLessThan(50);
    expect(mean(expert.map(r => r.summary.styles.adaptability))).toBeGreaterThan(85);
    const handled = (rs: SyntheticRun[]) => { const e = rs.flatMap(r => r.weeks.flatMap(w => w.events.filter(x => x.expected))); return e.filter(x => x.handled).length / Math.max(1, e.length); };
    expect(handled(beginner)).toBeLessThan(0.4);
    expect(handled(expert)).toBeGreaterThan(0.8);
    const surfaced = (rs: SyntheticRun[]) => rs.reduce((n, r) => n + r.conversations.filter(c => c.concernSurfaced).length, 0);
    expect(surfaced(expert)).toBeGreaterThan(surfaced(beginner));
    // The Beginner overspends: it spends nearly every day; its conversations rate Weak or worse.
    const bands = beginner.flatMap(r => r.conversations.map(c => c.evaluation?.band)).filter(Boolean);
    expect(bands.filter(b => b === 'weak' || b === 'harmful').length / bands.length).toBeGreaterThan(0.8);
    const strong = expert.flatMap(r => r.conversations.map(c => c.evaluation?.band)).filter(b => b === 'strong').length;
    expect(strong / expert.flatMap(r => r.conversations).length).toBeGreaterThan(0.75);
  });

  it('record each week and each conversation with the evaluator\'s reading', async () => {
    const run = await playSynthetic(RBL, 'proficient', 5);
    expect(run.weeks).toHaveLength(RBL.time.period.count);
    expect(run.weeks.every(w => w.styleFit && w.styleFit.total > 0)).toBe(true);
    const talk = run.conversations.find(c => c.format === 'roleplay' && c.evaluation);
    expect(talk?.turns.some(t => t.by === 'player')).toBe(true);
    expect(talk?.turns.some(t => t.by === 'other')).toBe(true);
    expect(talk?.evaluation?.dimensions.length).toBeGreaterThan(0);
    expect(run.summary.score.total).toBe(run.view.score.total);
  });

  it('speak through the speaker they are given, with the lens, the person and the transcript', async () => {
    const seen: SpeakerContext[] = [];
    const speaker = { say: (ctx: SpeakerContext) => { seen.push(ctx); return templateSpeaker.say(ctx); } };
    const run = await playSynthetic(FIVE, 'expert', 2, { speaker, describe: 'Calm and curious.' });
    expect(seen.length).toBeGreaterThan(10);
    // An off day speaks one level lower (the polish trait).
    expect(seen.every(c => c.level >= 2 && c.describe === 'Calm and curious.' && c.lens.styles.length === 5)).toBe(true);
    const later = seen.find(c => c.turn > 0 && c.person);
    expect(later?.transcript.length).toBeGreaterThan(1);
    expect(later?.person?.needLabel).toBeTruthy();
    expect(run.conversations.length).toBeGreaterThan(0);
  });

  it('use the evaluator they are given, so the scoring pipeline is what is tested', async () => {
    let calls = 0;
    const evaluator = { evaluate: (i: Parameters<typeof heuristicEvaluator.evaluate>[0]) => { calls++; return heuristicEvaluator.evaluate(i) as Evaluation; } };
    const run = await playSynthetic(RBL, 'developing', 4, { evaluator });
    expect(calls).toBe(run.conversations.filter(c => c.evaluation).length);
    expect(calls).toBeGreaterThan(5);
  });

  it('probe one style and one action', async () => {
    const style = await playSynthetic(RBL, 'proficient', 4, { probe: { kind: 'style', style: 'P' } });
    expect(new Set(style.weeks.flatMap(w => Object.values(w.styles)))).toEqual(new Set(['P']));
    const action = await playSynthetic(RBL, 'developing', 4, { probe: { kind: 'action', action: 'coach' } });
    expect(new Set(action.weeks.flatMap(w => w.actions.map(a => a.key)))).toEqual(new Set(['coach']));
  });

  it('describe each persona in plain words with no dashes', () => {
    for (const p of PERSONAS) expect(copyViolations(`${PERSONA_COPY[p].name} ${PERSONA_COPY[p].label} ${PERSONA_COPY[p].plays}`)).toEqual([]);
  });
});

describe('synthetic speech', () => {
  const lensOf = (c: StorylineConfig) => ({ title: c.lens.title, styles: c.lens.styles.map(s => ({ key: s.key, name: s.name, short: s.short, description: s.description })) });
  const SIX = parse(withSixStyles(raw as unknown as StorylineInput));
  const ctx = (c: StorylineConfig, level: Level, intent: string | null, format = 'roleplay', extra: Partial<SpeakerContext> = {}): SpeakerContext => ({
    persona: 'expert', level, describe: '', lens: lensOf(c), intent, format, action: { key: 'f2f', name: 'Meet face to face' },
    person: { id: 'kent', name: 'Kent Brown', first: 'Kent', mood: 'concerned', trust: 50, skill: 30, morale: 30, result: 40, needLabel: 'Learning and unsure', concern: null },
    team: ['Kent', 'Beth'], transcript: [], turn: 0, turns: 4, promise: true, variant: 0, slip: false, emailIntent: 'congratulate',
    business: { share: 0.4, runShare: 0.5, behind: 2, risk: 'Proposal' }, ...extra
  });
  const read = (c: StorylineConfig, text: string, format = 'roleplay') => heuristicEvaluator.evaluate({ format, text, styles: lensOf(c).styles }) as Evaluation;

  it.each([['four', RBL], ['five', FIVE], ['six', SIX]] as const)('says every style of a %s style lens so the evaluator reads it', (_, c) => {
    for (const s of c.lens.styles) for (const level of [1, 2, 3] as Level[]) {
      expect(read(c, script(ctx(c, level, s.key)).join('\n')).styleUsed, `${s.key} at level ${level}`).toBe(s.key);
    }
  });

  it('rises in quality with the level', () => {
    const rank = { harmful: 0, weak: 1, adequate: 2, strong: 3 };
    for (const c of [RBL, FIVE]) for (const s of c.lens.styles) {
      const bands = ([0, 1, 2, 3] as Level[]).map(l => rank[read(c, script(ctx(c, l, s.key)).join('\n')).band]);
      // A Beginner's blunt line rates Weak, or Adequate when the style's own words happen to cover a rubric point.
      expect(bands[0]).toBeLessThanOrEqual(c === RBL ? 1 : 2);
      expect(bands[3]).toBe(3);
      for (let i = 1; i < 4; i++) expect(bands[i]).toBeGreaterThanOrEqual(bands[i - 1]);
    }
    expect(read(RBL, script(ctx(RBL, 0, 'D', 'roleplay', { slip: true })).join(' ')).band).toBe('harmful');
  });

  it('covers every format with plain copy, no dashes', () => {
    for (const format of ['roleplay', 'chat', 'email', 'meeting', 'sponsor', 'interview', 'plan']) for (const level of [0, 1, 2, 3] as Level[]) {
      for (const line of script(ctx(RBL, level, 'G', format))) expect(copyViolations(line), `${format} ${level}: ${line}`).toEqual([]);
      for (const v of Object.values(planFields(ctx(RBL, level, 'G', format)))) if (typeof v === 'string') expect(copyViolations(v)).toEqual([]);
    }
    expect(read(RBL, script(ctx(RBL, 3, null, 'sponsor')).join(' '), 'sponsor').band).toBe('strong');
    expect(read(RBL, script(ctx(RBL, 0, null, 'sponsor')).join(' '), 'sponsor').band).toBe('weak');
  });

  it('keeps the close when a conversation is shorter than the script', () => {
    expect(lineFor(['a', 'b', 'c', 'd'], 0, 2)).toBe('a');
    expect(lineFor(['a', 'b', 'c', 'd'], 1, 2)).toBe('b c d');
    expect(lineFor(['a', 'b'], 3, 4)).toBe('b');
    expect(lineFor(['a'], 0, 1)).toBe('a');
  });

  it('asks an Expert question that surfaces a concern and makes a promise the evaluator records', () => {
    const text = script(ctx(RBL, 3, 'P')).join('\n');
    const e = read(RBL, text);
    expect(e.flags.concernSurfaced).toBe(true);
    expect(e.flags.promise?.text).toMatch(/^I'll check in with you by friday$/i);
  });
});
