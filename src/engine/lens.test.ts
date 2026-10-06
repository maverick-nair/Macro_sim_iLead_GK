import { describe, expect, it } from 'vitest';
import { copyViolations } from '../i18n/copy';
import { parseStoryline, type StorylineConfig, type StorylineInput } from './config';
import { EngineView } from './contract';
import { NEEDS } from './lens';
import { DEFAULT_LENS } from './lensLibrary';
import { createEngine } from './sim/engine';
import { heuristicEvaluator } from './sim/evaluator';
import { neededStyles, play } from './sim/policies';
import salesElevator from './storylines/sales-elevator.json';
import { SIX_STYLES_LENS, withSixStyles } from './storylines/sixStyles';

const raw = salesElevator as unknown as StorylineInput;
const parse = (input: unknown): StorylineConfig => {
  const r = parseStoryline(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.config;
};
const issues = (input: unknown) => { const r = parseStoryline(input); return r.ok ? [] : r.issues; };
const withLens = (lens: unknown) => ({ ...raw, lens });

describe('lens schema (D70)', () => {
  it('defaults to Readiness Based Leadership, so storylines without a lens parse unchanged', () => {
    const c = parse(raw);
    expect(c.lens.id).toBe('readiness_based');
    expect(c.lens.styles.map(s => s.key)).toEqual(['D', 'G', 'P', 'E']);
    expect(c.lens.fit).toEqual(DEFAULT_LENS.fit);
    expect(parse(withLens(DEFAULT_LENS)).lens).toEqual(c.lens);
  });

  it('takes 2 to 6 styles with unique keys and letters', () => {
    const two = { ...DEFAULT_LENS, styles: DEFAULT_LENS.styles.slice(0, 2), fit: Object.fromEntries(NEEDS.map(n => [n, { D: 0, G: 1 }])) };
    expect(issues({ ...withLens(two), actions: raw.actions.map(a => ({ ...a, options: a.options.map(o => ({ ...o, style: undefined })) })) })).toEqual([]);
    expect(issues(withLens({ ...two, styles: DEFAULT_LENS.styles.slice(0, 1), fit: Object.fromEntries(NEEDS.map(n => [n, { D: 0 }])) })).join()).toMatch(/lens\.styles/);
    const seven = [...SIX_STYLES_LENS.styles, { key: 'extra', letter: 'X', name: 'Extra', short: 'One more.', description: 'One more.' }];
    expect(issues(withLens({ ...SIX_STYLES_LENS, styles: seven })).join()).toMatch(/lens\.styles/);
    const dup = { ...DEFAULT_LENS, styles: DEFAULT_LENS.styles.map(s => ({ ...s, letter: 'D' })) };
    expect(issues(withLens(dup)).join()).toMatch(/letters must be unique/);
    expect(issues(withLens({ ...DEFAULT_LENS, styles: DEFAULT_LENS.styles.map((s, i) => ({ ...s, letter: i ? 'ABC' : s.letter })) })).join()).toMatch(/One or two characters/);
  });

  it('needs every style in every need, only known styles, and one fit of 0 per need', () => {
    const fit = structuredClone(DEFAULT_LENS.fit) as Record<string, Record<string, number>>;
    delete fit.lowSkill_lowMorale.E;
    expect(issues(withLens({ ...DEFAULT_LENS, fit })).join()).toMatch(/lens\.fit\.lowSkill_lowMorale\.E: Give E a fit/);
    const extra = { ...DEFAULT_LENS, fit: { ...DEFAULT_LENS.fit, highSkill_highMorale: { ...DEFAULT_LENS.fit.highSkill_highMorale, Z: 1 } } };
    expect(issues(withLens(extra)).join()).toMatch(/No style called Z/);
    const none = { ...DEFAULT_LENS, fit: { ...DEFAULT_LENS.fit, lowSkill_highMorale: { D: 1, G: 1, P: 2, E: 1 } } };
    expect(issues(withLens(none)).join()).toMatch(/lowSkill_highMorale: At least one style must fit/);
    const three = { ...DEFAULT_LENS, fit: { ...DEFAULT_LENS.fit, lowSkill_highMorale: { D: 3, G: 0, P: 2, E: 1 } } };
    expect(issues(withLens(three)).length).toBeGreaterThan(0);
  });

  it('checks action option styles against the lens', () => {
    expect(issues(withLens(SIX_STYLES_LENS)).join()).toMatch(/options\.0\.style: No style called D in the lens/);
    expect(issues(withSixStyles(raw))).toEqual([]);
    expect(issues({ ...withSixStyles(raw), lens: { ...SIX_STYLES_LENS, secondary: { id: 'six_styles', title: 'Six Leadership Styles' } } }).join()).toMatch(/secondary/);
  });
});

describe('Six Leadership Styles, end to end (D70)', () => {
  const config = parse(withSixStyles(raw));

  it('reads the style shown among the lens styles, from each style\'s own words', () => {
    for (const s of SIX_STYLES_LENS.styles) {
      const ev = heuristicEvaluator.evaluate({ format: 'roleplay', text: `${s.name}. ${s.short}`, styles: SIX_STYLES_LENS.styles }) as ReturnType<typeof heuristicEvaluator.evaluate> & { styleUsed: string };
      expect(ev.styleUsed).toBe(s.key);
    }
    // Readiness Based keys keep their cues.
    expect((heuristicEvaluator.evaluate({ format: 'roleplay', text: 'I trust you, it is your call.', styles: DEFAULT_LENS.styles }) as { styleUsed: string }).styleUsed).toBe('E');
  });

  it('plays a full mock run with six styles: style setting, conversations, week ends and the report', async () => {
    const good = await play(config, 'good', 3);
    const random = await play(config, 'random', 3);
    const v = EngineView.parse(good.view);
    expect(v.phase).toBe('ended');
    expect(v.lens.styles.map(s => s.name)).toEqual(['Vision Setter', 'Coach', 'Harmoniser', 'Collaborator', 'Pace Setter', 'Commander']);
    expect(v.lens.needs.map(n => n.key)).toEqual([...NEEDS]);
    // The good player reads every need through the fit table and gets every weekly style right.
    expect(v.periods.every(p => p.week.styleFit.correct === p.week.styleFit.total)).toBe(true);
    expect(v.score.capability).toBeGreaterThan(70);
    expect(v.score.total).toBeGreaterThan(random.view.score.total);

    const r = v.report!;
    expect(Object.keys(r.style.shares)).toEqual(SIX_STYLES_LENS.styles.map(s => s.key));
    expect(r.style.grid).toHaveLength(4);
    expect(r.style.grid.every(row => row.length === 6)).toBe(true);
    expect(r.methodology.lines[0]).toBe('This simulation looks at leadership through the Six Leadership Styles lens.');
    expect(r.methodology.lines[1]).toMatch(/Inspire and Deliver/);
    // Report only skills: in the skills section, never in the summary or the plan.
    const only = r.skills.filter(s => s.reportOnly).map(s => s.key);
    expect(only).toEqual(['team_engagement', 'delivery_performance']);
    expect([...r.summary.strengths, ...r.summary.priorities].some(k => only.includes(k))).toBe(false);
    expect(r.plan.some(p => only.includes(p.skill))).toBe(false);
    for (const s of r.skills.filter(x => x.reportOnly)) if (s.observations < 2) expect(s.level).toBeNull();
    // The source is author only; the copy rules hold for every lens string sent.
    const json = JSON.stringify(v);
    expect(json).not.toMatch(/Goleman|Hersey|basedOn/);
    expect(copyViolations([...v.lens.styles.flatMap(s => [s.name, s.short, s.description]), ...v.lens.needs.flatMap(n => [n.label, n.short])].join(' '))).toEqual([]);
  });

  it('rejects a style the lens does not have', async () => {
    const e = createEngine(config, { seed: 1 });
    const styles = await neededStyles(e, config.thresholds.high, config.lens);
    expect(Object.values(styles).every(k => config.lens.styles.some(s => s.key === k))).toBe(true);
    await expect(e.dispatch({ type: 'confirmStyles', styles: { ...styles, kent: 'D' } })).rejects.toMatchObject({ code: 'unknownStyle' });
    await e.dispatch({ type: 'confirmStyles', styles });
    expect(e.view().members.find(m => m.id === 'kent')!.style).toBe(styles.kent);
  });

  it('keeps report only skills out of the score: the Leadership Score does not move with them', async () => {
    const plain = parse({ ...withSixStyles(raw), report: { ...withSixStyles(raw).report, skills: withSixStyles(raw).report!.skills!.filter(s => !s.reportOnly), linkage: undefined } });
    const a = await play(config, 'good', 5), b = await play(plain, 'good', 5);
    expect(a.view.score).toEqual(b.view.score);
    expect(a.view.badges).toEqual(b.view.badges);
  });
});
