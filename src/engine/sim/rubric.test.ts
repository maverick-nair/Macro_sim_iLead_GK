import { describe, expect, it } from 'vitest';
import { parseStoryline, type StorylineInput } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { createEngine } from './engine';
import { DEFAULT_RUBRIC, heuristicEvaluator, RUBRIC_LABELS, type EvaluationInput } from './evaluator';
import { neededStyles } from './policies';
import type { Evaluation } from './types';

/**
 * The rubric in the author's words (D229): a dimension's phrases count as evidence for the keyword evaluator, and the
 * engine hands the storyline's rubric and skill anchors to whichever evaluator it has, so editing them drives the rating.
 */
const raw = salesElevator as unknown as StorylineInput;
const ANSWER = 'Your numbers are slipping. I need you to close two deals this week.';

describe('the rubric behind the rating (D229)', () => {
  it('reads an author\'s phrases as evidence of a dimension, and nothing changes without them', () => {
    const plain = heuristicEvaluator.evaluate({ format: 'roleplay', text: ANSWER }) as Evaluation;
    expect(plain.dimensions.find(d => d.key === 'listening')!.band).toBe('weak');
    const rubric = DEFAULT_RUBRIC.roleplay.map(key => ({ key, label: RUBRIC_LABELS[key], cues: key === 'listening' ? ['numbers are slipping'] : [] }));
    const cued = heuristicEvaluator.evaluate({ format: 'roleplay', text: ANSWER, rubric }) as Evaluation;
    expect(cued.dimensions.find(d => d.key === 'listening')!.band).toBe('adequate');
    expect(heuristicEvaluator.evaluate({ format: 'roleplay', text: ANSWER, rubric: DEFAULT_RUBRIC.roleplay.map(key => ({ key })) })).toEqual(plain);
  });

  it('labels every default dimension in plain words', () => {
    for (const keys of Object.values(DEFAULT_RUBRIC)) for (const k of keys) expect(RUBRIC_LABELS[k], k).toMatch(/^[A-Z][a-z]+: [a-z]/);
  });

  it('hands the storyline\'s rubric, with its phrases, and the skills\' anchors to the evaluator', async () => {
    const actions = raw.actions.map(a => (a.key === 'f2f' ? { ...a, live: { ...a.live, rubric: [{ key: 'listening', label: 'Listening: asks about their beat first', cues: ['your beat'] }, { key: 'clarity', label: 'Clarity' }] } } : a));
    const p = parseStoryline({ ...raw, actions });
    if (!p.ok) throw new Error(p.issues.join('\n'));
    const seen: EvaluationInput[] = [];
    const e = createEngine(p.config, { seed: 1, evaluator: { evaluate: i => { seen.push(i); return heuristicEvaluator.evaluate(i); } } });
    await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
    const m = e.view().members[0];
    const r = await e.dispatch({ type: 'planAction', action: 'f2f', option: e.view().actions.find(a => a.key === 'f2f')!.options[0].key, memberIds: [m.id] });
    await e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: 'How is your beat going this week?' });
    const input = seen.at(-1)!;
    expect(input.rubric).toEqual([{ key: 'listening', label: 'Listening: asks about their beat first', cues: ['your beat'] }, { key: 'clarity', label: 'Clarity' }]);
    expect(input.skillDefs?.length).toBe(input.skills?.length);
    expect(input.skillDefs?.every(s => s.anchors && s.anchors.length === p.config.report.scale.length)).toBe(true);
  });
});
