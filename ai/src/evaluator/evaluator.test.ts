import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createEngine } from '../../../src/engine/sim/engine';
import { neededStyles } from '../../../src/engine/sim/policies';
import { settingsFor, silentLogger } from '../config';
import { createFakeTransport, type FakeReply } from '../llm/fake';
import { createAnthropicNpcModel } from '../npc/models';
import { CalibrationSet, sampleInput } from '../quality/calibrate';
import { config, PARTICIPANT, recordedEvaluation } from '../testing/fixtures';
import type { EvaluationAudit, EvaluatorInput } from '../types';
import { createAnthropicEvaluator, createMockEvaluator } from './models';
import { buildEvaluatorRequest, evaluatorPromptVersion } from './prompt';
import { EvaluationSchema, type ModelEvaluation } from './schema';

const input = (over: Partial<EvaluatorInput> = {}): EvaluatorInput => ({
  format: 'roleplay', text: PARTICIPANT, usedVoice: true, skills: ['coaching_for_growth'], locale: 'en-US', actionKey: 'f2f', actionName: 'Meet face to face',
  counterpart: { name: 'Kent Goldberg', title: 'Lead Generation Executive', hiddenConcern: 'He feels the job is not what he was promised.' }, ...over
});

function evaluator(script: FakeReply[], repairRetries?: number) {
  const transport = createFakeTransport(script);
  const logger = { ...silentLogger, warn: vi.fn(), error: vi.fn() };
  const audits: EvaluationAudit[] = [];
  const ev = createAnthropicEvaluator({ transport, settings: settingsFor('evaluator'), logger, repairRetries, onAudit: a => audits.push(a) });
  return { ev, transport, logger, audits };
}
const answer = (over: Partial<ModelEvaluation> = {}) => JSON.stringify(recordedEvaluation(over));

describe('evaluator prompt assembly', () => {
  it('caches the rules, the format guide and the interaction context; the words come last', () => {
    const { req } = buildEvaluatorRequest(input(), settingsFor('evaluator'));
    expect(req.system.map(s => !!s.cache)).toEqual([false, false, true]);
    expect(req.system[0].text).toMatch(/Score the participant's words only/);
    expect(req.system[1].text).toMatch(/one to one conversation/);
    expect(req.system[2].text).toMatch(/- listening\n- clarity\n- involvement/);
    expect(req.system[2].text).toMatch(/coaching_for_growth: Coaching for growth/);
    expect(req.system[2].text).toMatch(/level 5: /);
    expect(req.system[2].text).toMatch(/- D: Directing/);
    expect(req.system[2].text).toMatch(/Language for reasons: English \(United States\)/);
    expect(req.messages[0].content).toMatch(/<participant_words>\nThanks for making time/);
  });

  it('never sends anything about the voice', () => {
    const spoken = buildEvaluatorRequest(input({ usedVoice: true }), settingsFor('evaluator')).req;
    const typed = buildEvaluatorRequest(input({ usedVoice: false }), settingsFor('evaluator')).req;
    expect(spoken).toEqual(typed);
    expect(JSON.stringify(spoken)).not.toMatch(/usedVoice/);
  });

  it('constrains the answer to the requested keys and the lens styles', () => {
    const { req } = buildEvaluatorRequest(input({ rubric: [{ key: 'tone' }, { key: 'fairness' }], styles: [{ key: 'coach', name: 'Coach', short: 'x' }, { key: 'pace', name: 'Pace Setter', short: 'y' }] }), settingsFor('evaluator'));
    const s = req.jsonSchema as { properties: Record<string, { items?: { properties: Record<string, { enum?: string[] }> }; properties?: Record<string, { enum?: string[] }> }> };
    expect(s.properties.dimensions.items!.properties.key.enum).toEqual(['tone', 'fairness']);
    expect(s.properties.style.properties!.key.enum).toEqual(['coach', 'pace']);
  });

  it('uses the format guide for each format and versions it', () => {
    for (const f of ['roleplay', 'chat', 'email', 'meeting', 'sponsor', 'interview', 'plan']) expect(evaluatorPromptVersion(f)).toMatch(new RegExp(`^evaluator@1#\\w{8}\\+evaluator\\.${f}@1#\\w{8}$`));
  });
});

describe('the Anthropic evaluator (recorded answers)', () => {
  it('returns the engine shape with verified quotes, the engine rule for the overall band, and an audit record', async () => {
    const { ev, audits } = evaluator([answer()]);
    const { evaluation, audit } = await ev.evaluateWithAudit(input());
    expect(EvaluationSchema.parse(evaluation)).toEqual(evaluation);
    expect(evaluation.band).toBe('strong');
    expect(evaluation.dimensions.map(d => d.band)).toEqual(['strong', 'strong', 'adequate']);
    expect(evaluation.evidence).toEqual(['How are you finding the role so far?', 'I hear you.']);
    expect(evaluation.flags.promise).toEqual({ text: 'I will come back to you by Friday', dueInSubPeriods: 3, fulfilledBy: ['f2f'] });
    expect(evaluation.usedVoice).toBe(true);
    expect(evaluation.emailIntent).toBeUndefined();
    expect(audit).toMatchObject({ provider: 'anthropic', fallback: false, repaired: false, droppedQuotes: [], promptVersion: evaluatorPromptVersion('roleplay'), locale: 'en-US' });
    expect(audit.reasons.listening).toMatch(/open question/);
    expect(audits).toEqual([audit]);
  });

  it('drops quotes that are not verbatim, and a band above Weak without one falls to Weak', async () => {
    const { ev } = evaluator([answer({
      dimensions: [
        { key: 'listening', band: 'strong', reason: 'r', quotes: ['How are you finding your role?'] },
        { key: 'clarity', band: 'strong', reason: 'r', quotes: ['I will come back to you by Friday'] },
        { key: 'involvement', band: 'strong', reason: 'r', quotes: ['What do you think we should change?'] }
      ],
      skills: [{ key: 'coaching_for_growth', band: 'strong', quotes: ['You asked great questions'] }]
    })]);
    const { evaluation, audit } = await ev.evaluateWithAudit(input());
    expect(evaluation.dimensions.map(d => d.band)).toEqual(['weak', 'strong', 'weak']);
    expect(evaluation.band).toBe('weak');
    expect(evaluation.skills).toEqual([{ key: 'coaching_for_growth', band: 'weak', evidence: [] }]);
    expect(audit.droppedQuotes).toEqual(['How are you finding your role?', 'What do you think we should change?', 'You asked great questions']);
    expect(audit.adjustments).toHaveLength(3);
  });

  it('keeps a red flag only with a verbatim quote; one forces Harmful on the band and the skills', async () => {
    const text = `${PARTICIPANT}\nHonestly, this is all your fault.`;
    const flagged = evaluator([answer({ redFlags: [{ kind: 'blame', quote: 'this is all your fault.' }] })]);
    const a = await flagged.ev.evaluate(input({ text }));
    expect(a.band).toBe('harmful');
    expect(a.redFlags).toEqual(['blame']);
    expect(a.skills?.[0].band).toBe('harmful');
    expect(a.evidence[0]).toBe('this is all your fault.');
    const invented = evaluator([answer({ redFlags: [{ kind: 'abuse', quote: 'you idiot' }] })]);
    const b = await invented.ev.evaluate(input());
    expect(b.redFlags).toEqual([]);
    expect(b.flags.abusive).toBe(false);
    expect(b.band).toBe('strong');
  });

  it('repairs an answer that fails validation once, then uses it', async () => {
    const { ev, transport } = evaluator(['{"dimensions": "oops"}', answer()]);
    const { evaluation, audit } = await ev.evaluateWithAudit(input());
    expect(audit.repaired).toBe(true);
    expect(evaluation.band).toBe('strong');
    expect(transport.requests[1].messages.at(-1)!.content).toMatch(/could not be used/);
  });

  it('asks for a repair when the model names a dimension or style that was not asked for', async () => {
    const wrong = recordedEvaluation({ style: { key: 'Z', confidence: 0.5 } });
    wrong.dimensions[2].key = 'empathy';
    const { ev, transport } = evaluator([JSON.stringify(wrong), answer()]);
    await ev.evaluate(input());
    const issues = transport.requests[1].messages.at(-1)!.content as string;
    expect(issues).toMatch(/missing involvement/);
    expect(issues).toMatch(/empathy is not a rubric dimension/);
    expect(issues).toMatch(/style: Z is not one of D, G, P, E/);
  });

  it('falls back to the heuristic after a failed repair, logs the error and audits it', async () => {
    const { ev, logger, audits } = evaluator(['not json', 'still not json']);
    const evaluation = await ev.evaluate(input());
    expect(EvaluationSchema.parse(evaluation)).toBeTruthy();
    expect(audits[0]).toMatchObject({ fallback: true, provider: 'anthropic' });
    expect(audits[0].error).toMatch(/no valid reply/);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('falls back on a refusal or a failed call, and never calls the model for empty words', async () => {
    const refused = evaluator([{ text: '', stopReason: 'refusal' }]);
    expect((await refused.ev.evaluateWithAudit(input())).audit).toMatchObject({ fallback: true, error: 'refusal' });
    const failed = evaluator([{ error: new Error('529 overloaded') }]);
    expect((await failed.ev.evaluateWithAudit(input())).audit.fallback).toBe(true);
    const empty = evaluator([]);
    await empty.ev.evaluate(input({ text: '   ' }));
    expect(empty.transport.requests).toHaveLength(0);
  });

  it('reads email intent for emails only, and scores words in any language the same way', async () => {
    const email = evaluator([answer({ emailIntent: 'congratulate', dimensions: [
      { key: 'specificity', band: 'adequate', reason: 'r', quotes: ['by Friday'] }, { key: 'tone', band: 'strong', reason: 'r', quotes: ['I hear you.'] }, { key: 'fairness', band: 'adequate', reason: 'r', quotes: ['Thanks for making time'] }
    ] })]);
    expect((await email.ev.evaluate(input({ format: 'email' }))).emailIntent).toBe('congratulate');
    const es = 'Gracias por tu tiempo. ¿Cómo te sientes en el puesto? Te escucho.';
    const spanish = evaluator([answer({ dimensions: [
      { key: 'listening', band: 'strong', reason: 'Pregunta abierta y reconocimiento.', quotes: ['¿Cómo te sientes en el puesto?', 'Te escucho.'] },
      { key: 'clarity', band: 'weak', reason: 'Sin próximo paso.', quotes: [] }, { key: 'involvement', band: 'weak', reason: 'No invita ideas.', quotes: [] }
    ], skills: [], promise: null })]);
    const { evaluation, audit } = await spanish.ev.evaluateWithAudit(input({ text: es, locale: 'es-MX' }));
    expect(evaluation.dimensions[0].evidence).toEqual(['¿Cómo te sientes en el puesto?', 'Te escucho.']);
    expect(audit.reasons.listening).toMatch(/Pregunta/);
    expect(spanish.transport.requests[0].system[2].text).toMatch(/Spanish \(Mexico\)/);
  });
});

describe('the mock evaluator', () => {
  it('returns the engine shape for every calibration sample', async () => {
    const set = CalibrationSet.parse(JSON.parse(readFileSync(new URL('../../calibration/sales-elevator.json', import.meta.url), 'utf8')));
    const ev = createMockEvaluator();
    for (const [action, spec] of Object.entries(set.actions)) for (const s of spec.samples) {
      const e = await ev.evaluate(sampleInput(config, action, spec.counterpart, s.text));
      expect(EvaluationSchema.safeParse(e).success, s.id).toBe(true);
    }
  });
});

describe('the engine with the AI layer plugged in', () => {
  it('runs a 1:1 on the Anthropic NPC model and evaluator over a fake client', async () => {
    const transport = createFakeTransport([], { fallback: req => (req.label.startsWith('npc')
      ? 'Hi. It has been a busy week, to be honest. [[signals reveal=no end=no]]'
      : JSON.stringify(recordedEvaluation({ skills: [], promise: null, dimensions: [
        { key: 'listening', band: 'strong', reason: 'r', quotes: ['What is on your mind?', 'I appreciate it.'] },
        { key: 'clarity', band: 'adequate', reason: 'r', quotes: ['What is on your mind?'] },
        { key: 'involvement', band: 'strong', reason: 'r', quotes: ['What is on your mind?'] }
      ] }))) });
    const npc = createAnthropicNpcModel({ transport, settings: settingsFor('npc') });
    const evaluator = createAnthropicEvaluator({ transport, settings: settingsFor('evaluator') });
    const e = createEngine(config, { seed: 1, npc, evaluator });
    await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
    const r = await e.dispatch({ type: 'planAction', action: 'f2f', memberIds: ['kent'] });
    expect(e.view().live!.turns[0].text).toBe('Hi. It has been a busy week, to be honest.');
    await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: 'Thanks for making time, I appreciate it. What is on your mind?' });
    const end = await e.dispatch({ type: 'endInteraction', interactionId: r.interactionId! });
    expect(end.outcome?.changes.length).toBeGreaterThan(0);
    expect(transport.requests.map(q => q.label.split(' ')[0])).toEqual(['npc', 'npc', 'evaluator']);
  });
});
