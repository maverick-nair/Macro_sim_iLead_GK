import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import raw from '../storylines/sales-elevator.json';
import { parseStoryline, type StorylineConfig, type StorylineInput } from '../config';
import { withSixStyles } from '../storylines/sixStyles';
import { copyViolations } from '../../i18n/copy';
import { heuristicEvaluator } from './evaluator';
import { ARCHETYPES, PERSONA_COPY, PERSONAS, PLAYERS, playSynthetic, type PersonaKey, type PlayerKey, type SyntheticRun } from './synthetic';
import { hear } from './syntheticListen';
import * as Phrases from './syntheticPhrases';
import { levelOf, PERSONA_TRAITS, SKILL_TRAITS, type PersonaTraits } from './syntheticPolicy';
import { pairCount, topPairs } from './syntheticProbes';
import { lineFor, planFields, script, templateSpeaker, type Level, type SpeakerContext } from './syntheticSpeech';
import type { Evaluation } from './types';

const parse = (input: unknown): StorylineConfig => {
  const p = parseStoryline(input);
  if (!p.ok) throw new Error(p.issues.join('\n'));
  return p.config;
};
const RBL = parse(raw);
/** Six Leadership Styles: a lens of five styles, Pacesetting and Commanding merged into Drive (D104). */
const FIVE = parse({ ...withSixStyles(raw as unknown as StorylineInput), id: 'sales-elevator-five' });

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
async function many(config: StorylineConfig, persona: PlayerKey, n: number, seed = 11): Promise<SyntheticRun[]> {
  const out: SyntheticRun[] = [];
  for (let i = 0; i < n; i++) out.push(await playSynthetic(config, persona, seed + i));
  return out;
}
const actionsOf = (r: SyntheticRun) => r.weeks.flatMap(w => w.actions.map(a => a.key));

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
    // The Beginner's conversations rate Weak or worse; most of the Expert's rate Strong.
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

  it('speak through the speaker they are given, with the lens, the person, the transcript and what they already said', async () => {
    const seen: SpeakerContext[] = [];
    const speaker = { say: (ctx: SpeakerContext) => { seen.push({ ...ctx, said: [...(ctx.said ?? [])] }); return templateSpeaker.say(ctx); } };
    const run = await playSynthetic(FIVE, 'expert', 2, { speaker, describe: 'Calm and curious.' });
    expect(seen.length).toBeGreaterThan(10);
    // An off day speaks one level lower (the polish trait).
    expect(seen.every(c => c.level >= 2 && c.describe === 'Calm and curious.' && c.lens.styles.length === 5)).toBe(true);
    const later = seen.find(c => c.turn > 0 && c.person);
    expect(later?.transcript.length).toBeGreaterThan(1);
    expect(later?.transcript.at(-1)?.by).toBe('other');
    expect(later?.said).toHaveLength(later!.turn);
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

  it('describe each player in plain words with no dashes', () => {
    for (const p of PLAYERS) expect(copyViolations(`${PERSONA_COPY[p].name} ${PERSONA_COPY[p].label} ${PERSONA_COPY[p].plays}`)).toEqual([]);
  });
});

describe('probes (D114, D149)', () => {
  it('probe one style and one action', async () => {
    const style = await playSynthetic(RBL, 'proficient', 4, { probe: { kind: 'style', style: 'P' } });
    expect(new Set(style.weeks.flatMap(w => Object.values(w.styles)))).toEqual(new Set(['P']));
    // A probe tests mechanics: its words show the style it means.
    expect(style.conversations.filter(c => c.evaluation && c.intent).every(c => c.evaluation!.styleUsed === 'P')).toBe(true);
    const action = await playSynthetic(RBL, 'developing', 4, { probe: { kind: 'action', action: 'coach' } });
    expect(new Set(actionsOf(action))).toEqual(new Set(['coach']));
  });

  it('probe team energy every week with one style for everyone', async () => {
    const run = await playSynthetic(RBL, 'proficient', 4, { probe: { kind: 'energize', style: 'D' } });
    expect(new Set(run.weeks.flatMap(w => Object.values(w.styles)))).toEqual(new Set(['D']));
    expect(run.weeks.filter(w => w.actions.some(a => a.key === 'energize')).length).toBeGreaterThanOrEqual(RBL.time.period.count - 1);
  });

  it('probe a pair of actions, alternated, with an Expert\'s reading and nothing else', async () => {
    const run = await playSynthetic(RBL, 'expert', 4, { probe: { kind: 'pair', actions: ['energize', 'f2f'] } });
    const acts = actionsOf(run);
    expect(new Set(acts)).toEqual(new Set(['energize', 'f2f']));
    expect(run.weeks.flatMap(w => w.events).filter(e => e.expected && e.handled)).toEqual([]);
    expect(run.summary.styles.adaptability).toBeGreaterThan(85);
  });

  it('probe as many actions as possible, and reading people without acting', async () => {
    const busy = await playSynthetic(RBL, 'developing', 4, { probe: { kind: 'busy' } });
    const developing = await playSynthetic(RBL, 'developing', 4);
    expect(new Set(actionsOf(busy)).size).toBeGreaterThan(4);
    expect(actionsOf(busy).length).toBeGreaterThanOrEqual(actionsOf(developing).length);
    const idle = await playSynthetic(RBL, 'expert', 4, { probe: { kind: 'idle' } });
    expect(actionsOf(idle)).toEqual([]);
    expect(idle.conversations).toEqual([]);
    expect(idle.summary.styles.adaptability).toBeGreaterThan(85);
  });

  it('pick pairs from the top single action probes, with team energy, never hiring or letting go', () => {
    const singles = [['meet', 500], ['goals', 480], ['coach', 470], ['f2f', 300], ['hire', 900], ['fire', 900]].map(([action, score]) => ({ action: action as string, score: score as number }));
    const pairs = topPairs(RBL, singles);
    expect(pairs).toHaveLength(pairCount(RBL));
    expect(pairs).toEqual([['meet', 'goals'], ['meet', 'coach'], ['meet', 'energize'], ['goals', 'coach'], ['goals', 'energize'], ['coach', 'energize']]);
  });
});

describe('player types (D150)', () => {
  it('play from the participant\'s view, each its own way, and differently from each other', async () => {
    const runs = Object.fromEntries(await Promise.all(ARCHETYPES.map(async k => [k, await many(RBL, k, 2)] as const))) as Record<(typeof ARCHETYPES)[number], SyntheticRun[]>;
    const count = (rs: SyntheticRun[], key: string) => rs.reduce((n, r) => n + actionsOf(r).filter(a => a === key).length, 0) / rs.length;
    // Risk taker: lets people go or hires, and moves or rewards people.
    expect(count(runs.riskTaker, 'fire') + count(runs.riskTaker, 'hire')).toBeGreaterThan(0);
    expect(count(runs.riskTaker, 'reward') + count(runs.riskTaker, 'swap') + count(runs.riskTaker, 'assess')).toBeGreaterThan(1);
    // Conservative: few actions, no bold ones.
    const all = (rs: SyntheticRun[]) => mean(rs.map(r => actionsOf(r).length));
    expect(all(runs.conservative)).toBeLessThan(all(runs.riskTaker));
    expect(count(runs.conservative, 'fire') + count(runs.conservative, 'hire') + count(runs.conservative, 'swap')).toBe(0);
    // People first: team energy every week; Business first: training every week and no team energy to speak of.
    expect(count(runs.peopleFirst, 'energize')).toBeGreaterThanOrEqual(RBL.time.period.count - 1);
    expect(count(runs.businessFirst, 'training')).toBeGreaterThan(count(runs.peopleFirst, 'training') / 2);
    expect(count(runs.businessFirst, 'energize')).toBeLessThan(count(runs.peopleFirst, 'energize') / 2);
    // Every pair of types takes a clearly different mix of actions.
    const mix = (rs: SyntheticRun[]) => { const m = new Map<string, number>(); const acts = rs.flatMap(actionsOf); for (const a of acts) m.set(a, (m.get(a) ?? 0) + 1 / acts.length); return m; };
    const distance = (a: Map<string, number>, b: Map<string, number>) => [...new Set([...a.keys(), ...b.keys()])].reduce((d, k) => d + Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0)), 0) / 2;
    for (let i = 0; i < ARCHETYPES.length; i++) for (let j = i + 1; j < ARCHETYPES.length; j++) {
      expect(distance(mix(runs[ARCHETYPES[i]]), mix(runs[ARCHETYPES[j]])), `${ARCHETYPES[i]} and ${ARCHETYPES[j]}`).toBeGreaterThan(0.2);
    }
  });
});

describe('traits (D151)', () => {
  /**
   * Each skill trait moves the score the way it should: a level given the next level's value of one trait
   * never scores lower than the level as it is, beyond noise (2% of the scale, over ten seeds).
   */
  it('each skill trait moves the score in the expected direction across levels', async () => {
    const seeds = 10;
    const score = async (level: PersonaKey, traits: PersonaTraits) => {
      let total = 0;
      for (let i = 0; i < seeds; i++) total += (await playSynthetic(RBL, level, 31 + i, { policy: { traits, level: levelOf(level) } })).summary.score.total;
      return total / seeds;
    };
    const drops: string[] = [];
    for (let i = 0; i < PERSONAS.length - 1; i++) {
      const [lo, hi] = [PERSONAS[i], PERSONAS[i + 1]];
      const base = await score(lo, PERSONA_TRAITS[lo]);
      for (const [trait, better] of SKILL_TRAITS) {
        const [a, b] = [PERSONA_TRAITS[lo][trait] as number, PERSONA_TRAITS[hi][trait] as number];
        // The levels' values themselves rise (or fall, for the traits where less is better).
        expect(Math.sign(b - a) * better, `${trait} from ${lo} to ${hi}`).toBeGreaterThanOrEqual(0);
        if (a === b) continue;
        const moved = await score(lo, { ...PERSONA_TRAITS[lo], [trait]: b });
        if (moved < base - 0.02 * RBL.gamification.scale) drops.push(`${lo} with ${hi}'s ${trait}: ${Math.round(moved - base)}`);
      }
    }
    expect(drops).toEqual([]);
  }, 120_000);
});

describe('synthetic speech (D151)', () => {
  const lensOf = (c: StorylineConfig) => ({ title: c.lens.title, styles: c.lens.styles.map(s => ({ key: s.key, name: s.name, short: s.short, description: s.description })) });
  const ctx = (c: StorylineConfig, level: Level, intent: string | null, format = 'roleplay', extra: Partial<SpeakerContext> = {}): SpeakerContext => ({
    persona: 'expert', level, describe: '', lens: lensOf(c), intent, format, action: { key: 'f2f', name: 'Meet face to face' },
    person: { id: 'kent', name: 'Kent Brown', first: 'Kent', mood: 'concerned', trust: 50, skill: 30, morale: 30, result: 40, needLabel: 'Learning and unsure', concern: null },
    team: ['Kent', 'Beth'], transcript: [], turn: 0, turns: 4, promise: true, variant: 0, slip: false, emailIntent: 'congratulate',
    business: { share: 0.4, runShare: 0.5, behind: 2, risk: 'Proposal' }, ...extra
  });
  const read = (c: StorylineConfig, text: string, format = 'roleplay') => heuristicEvaluator.evaluate({ format, text, styles: lensOf(c).styles }) as Evaluation;
  const VARIANTS = Array.from({ length: 40 }, (_, i) => i * 37);
  const say = (c: SpeakerContext) => lineFor(script(c), c.turn, c.turns);

  it('never imports the evaluator or its cue lists: the phrasings are written apart from them', () => {
    for (const file of ['syntheticSpeech.ts', 'syntheticPhrases.ts', 'syntheticListen.ts']) {
      const src = fs.readFileSync(path.join(import.meta.dirname, file), 'utf8');
      expect(src, file).not.toMatch(/from '\.\/evaluator'|styleCues|DIM_CUES|\bCUES\b/);
    }
  });

  /**
   * Evaluator agreement: how often the offline evaluator reads a level's words as the style meant. Measured,
   * not built in (the results report it per player); these floors only catch a collapse.
   */
  it.each([['four', RBL, [0, 0.6, 0.75, 0.75]], ['five', FIVE, [0, 0.4, 0.6, 0.6]]] as const)('measures evaluator agreement on a %s style lens', (_, c, floors) => {
    for (const level of [1, 2, 3] as Level[]) {
      let meant = 0, agreed = 0;
      for (const s of c.lens.styles) for (const variant of VARIANTS) {
        meant++;
        if (read(c, script(ctx(c, level, s.key, 'roleplay', { variant })).join('\n')).styleUsed === s.key) agreed++;
      }
      expect(agreed / meant, `level ${level}`).toBeGreaterThanOrEqual(floors[level]);
    }
  });

  it('rises in quality with the level', () => {
    const rank = { harmful: 0, weak: 1, adequate: 2, strong: 3 };
    for (const c of [RBL, FIVE]) {
      const bands = ([0, 1, 2, 3] as Level[]).map(l => mean(c.lens.styles.flatMap(s => VARIANTS.map(variant => rank[read(c, script(ctx(c, l, s.key, 'roleplay', { variant })).join('\n')).band]))));
      for (let i = 1; i < 4; i++) expect(bands[i], `level ${i}`).toBeGreaterThan(bands[i - 1]);
      expect(bands[3]).toBeGreaterThan(2.5);
    }
    expect(read(RBL, script(ctx(RBL, 0, 'D', 'roleplay', { slip: true, variant: 0 })).join(' ')).band).toBe('harmful');
  });

  it('covers every format with plain copy, no dashes, in every phrasing', () => {
    for (const bank of Object.values(Phrases)) for (const line of JSON.stringify(bank).match(/"[^"]{3,}"/g) ?? []) expect(copyViolations(line), line).toEqual([]);
    for (const format of ['roleplay', 'chat', 'email', 'meeting', 'sponsor', 'interview', 'plan']) for (const level of [0, 1, 2, 3] as Level[]) for (const variant of VARIANTS.slice(0, 8)) {
      for (const line of script(ctx(RBL, level, 'G', format, { variant }))) expect(copyViolations(line), `${format} ${level}: ${line}`).toEqual([]);
      for (const v of Object.values(planFields(ctx(RBL, level, 'G', format, { variant })))) if (typeof v === 'string') expect(copyViolations(v)).toEqual([]);
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

  it('asks Expert questions that surface a concern, and makes a promise the evaluator records', () => {
    const texts = VARIANTS.map(variant => script(ctx(RBL, 3, 'P', 'roleplay', { variant })).join('\n'));
    expect(texts.filter(t => read(RBL, t).flags.concernSurfaced).length / texts.length).toBeGreaterThan(0.5);
    for (const t of texts) expect(read(RBL, t).flags.promise?.text, t).toMatch(/^I'll (check in with you|follow up with you|send you the account notes) by (friday|thursday|tomorrow)$|^I'll send you the account notes tomorrow$/i);
  });

  it('hears what the other person said', () => {
    expect(hear('Fair. I will have it ready.')).toBe('agreement');
    expect(hear('Okay. I can do that by then.')).toBe('agreement');
    expect(hear('My last appraisals have not gone well. I am trying, but some encouragement would go a long way.')).toBe('concern');
    expect(hear('The pipeline is slow, and I am not sure what is expected of me anymore.')).toBe('concern');
    expect(hear('Okay. If you say so.')).toBe('pushback');
    expect(hear('I am not sure that solves it, but fine.')).toBe('pushback');
    expect(hear('You wanted to see me? Honestly, it has been a rough week.')).toBe('emotional');
    expect(hear('Okay. I did not expect this meeting. What is it about?')).toBe('question');
    expect(hear('Things are okay. The work is moving, slowly.')).toBe('update');
    expect(hear('')).toBe('none');
  });

  it('answers what was just said: never "that sounds hard" after a yes, and comfort after a worry', () => {
    const after = (text: string, level: Level, variant: number) => say(ctx(RBL, level, 'D', 'roleplay', {
      turn: 1, variant, transcript: [{ by: 'other', name: 'Kent Brown', text: 'Hi. What did you want to talk about?' }, { by: 'player', name: 'You', text: 'Thanks, Kent. What is on your mind this week?' }, { by: 'other', name: 'Kent Brown', text }], said: ['Thanks, Kent. What is on your mind this week?']
    }));
    const concern = Phrases.REACT.concern[3];
    for (const variant of VARIANTS) {
      const yes = after('Fair. I will have it ready.', 3, variant);
      expect(yes, yes).not.toMatch(/sounds hard|thank you for telling me|that is a real worry/i);
      expect(Phrases.REACT.agreement[3].some(r => yes.startsWith(r)), yes).toBe(true);
      const worry = after('My last appraisals have not gone well. I am trying, but some encouragement would go a long way.', 3, variant);
      expect(concern.some(r => worry.startsWith(r)), worry).toBe(true);
      const doubt = after('I am not sure that solves it, but fine.', 2, variant);
      expect(Phrases.REACT.pushback[2].some(r => doubt.startsWith(r)), doubt).toBe(true);
    }
  });

  it('opens by answering how the person opened, by mood', () => {
    const open = (text: string, variant: number) => say(ctx(RBL, 3, 'P', 'roleplay', { variant, transcript: [{ by: 'other', name: 'Kent Brown', text }] }));
    for (const variant of VARIANTS.slice(0, 10)) {
      expect(Phrases.ANSWER_OPENING[3].some(a => open('Okay. I did not expect this meeting. What is it about?', variant).includes(a))).toBe(true);
      expect(Phrases.MEET_FEELING[3].some(a => open('You wanted to see me? Honestly, it has been a rough week.', variant).includes(a))).toBe(true);
    }
  });

  it('never repeats a line in one conversation, and varies its lines: over 30% distinct for every level', async () => {
    const names = new RegExp(`\\b(${[...RBL.members, ...RBL.candidates].map(m => m.name.split(' ')[0]).join('|')})\\b`, 'g');
    for (const persona of PERSONAS) {
      const runs = await many(RBL, persona, 3, 41);
      const lines: string[] = [];
      for (const c of runs.flatMap(r => r.conversations)) {
        const mine = c.turns.filter(t => t.by === 'player').map(t => t.text);
        expect(new Set(mine).size, mine.join(' / ')).toBe(mine.length);
        lines.push(...mine.map(t => t.replace(names, 'NAME')));
      }
      expect(new Set(lines).size / lines.length, persona).toBeGreaterThan(0.3);
    }
  });
});
