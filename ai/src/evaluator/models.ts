import { heuristicEvaluator, overallBand } from '../../../src/engine/sim/evaluator';
import type { Band, Evaluation } from '../../../src/engine/sim/types';
import { silentLogger, type ModelSettings } from '../config';
import { verifyQuotes } from '../guards/quotes';
import { isAbort, RefusalError, structuredCall, type LlmTransport } from '../llm/transport';
import { loadPrompt } from '../prompts';
import type { AiLogger, CallOptions, EvaluationAudit, Evaluator, EvaluatorInput } from '../types';
import { buildEvaluatorRequest, evaluatorPromptVersion, type ResolvedInput } from './prompt';
import { ModelEvaluation } from './schema';

/**
 * Evaluators. The mock is the engine's transparent keyword heuristic. The Anthropic evaluator asks the
 * model for bands, quotes and flags, validates the answer (one repair retry), then applies the
 * evidence rules in code: quotes must be verbatim, a band above Weak needs a quote, red flags need a
 * quote, and the overall band is the engine's rule (any red flag Harmful, else the median), never the
 * model's. When the model fails, the mock answers and the error is logged and audited.
 */

const sentences = (text: string) => text.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(Boolean);

async function mockEvaluation(input: EvaluatorInput): Promise<Evaluation> {
  return heuristicEvaluator.evaluate(input);
}

export function createMockEvaluator(o: { onAudit?(audit: EvaluationAudit, input: EvaluatorInput): void } = {}): Evaluator {
  const evaluateWithAudit = async (input: EvaluatorInput) => {
    const started = Date.now();
    const evaluation = await mockEvaluation(input);
    const audit: EvaluationAudit = {
      provider: 'mock', promptVersion: 'heuristic@1', model: null, fallback: false, repaired: false, droppedQuotes: [], adjustments: [],
      reasons: {}, locale: input.locale ?? 'en', latencyMs: Date.now() - started
    };
    o.onAudit?.(audit, input);
    return { evaluation, audit };
  };
  return {
    provider: 'mock',
    evaluateWithAudit,
    evaluate: async input => (await evaluateWithAudit(input)).evaluation,
    reply: heuristicEvaluator.reply
  };
}

/** Applies the evidence rules to a validated model answer and returns the engine's `Evaluation`. */
export function toEvaluation(m: ModelEvaluation, input: EvaluatorInput, r: ResolvedInput): { evaluation: Evaluation; droppedQuotes: string[]; adjustments: string[]; reasons: Record<string, string> } {
  const dropped: string[] = [];
  const adjustments: string[] = [];
  const verify = (quotes: string[]) => { const v = verifyQuotes(input.text, quotes); dropped.push(...v.dropped); return v.kept; };
  /** A band above Weak needs a verbatim quote; without one it falls to Weak. */
  const grounded = (what: string, band: Band, evidence: string[]): Band => {
    if (band !== 'weak' && !evidence.length) { adjustments.push(`${what}: ${band} without a verbatim quote, rated weak`); return 'weak'; }
    return band;
  };

  const byKey = new Map(m.dimensions.map(d => [d.key, d]));
  const reasons: Record<string, string> = {};
  const dimensions = r.dimensions.map(({ key }) => {
    const d = byKey.get(key)!;
    reasons[key] = d.reason;
    const evidence = verify(d.quotes);
    return { key, band: grounded(`dimension ${key}`, d.band, evidence), evidence };
  });

  const redFlags: string[] = [];
  const flagQuotes: string[] = [];
  for (const f of m.redFlags) {
    const q = verify([f.quote]);
    if (!q.length) { adjustments.push(`red flag ${f.kind}: no verbatim quote, dropped`); continue; }
    if (!redFlags.includes(f.kind)) redFlags.push(f.kind);
    flagQuotes.push(...q);
  }

  const skillByKey = new Map(m.skills.map(s => [s.key, s]));
  const skills = r.skills.flatMap(({ key }) => {
    const s = skillByKey.get(key);
    if (!s) return [];
    const evidence = verify(s.quotes);
    const band = redFlags.length ? 'harmful' as Band : grounded(`skill ${key}`, s.band, evidence);
    return [{ key, band, evidence: band === 'harmful' && !evidence.length ? flagQuotes.slice(0, 2) : evidence }];
  });

  const flags: Evaluation['flags'] = { ...m.flags, abusive: redFlags.includes('abuse') };
  if (m.promise) {
    const q = verify([m.promise.quote]);
    const by = m.promise.fulfilledBy.filter(a => r.promiseActions.includes(a));
    if (q.length) flags.promise = { text: q[0], dueInSubPeriods: Math.min(5, Math.max(1, m.promise.dueInSubPeriods)), fulfilledBy: by.length ? by : r.promiseActions };
    else adjustments.push('promise: no verbatim quote, dropped');
  }

  const quotes = [...flagQuotes, ...dimensions.flatMap(d => d.evidence)];
  const evidence = [...new Set(quotes)].slice(0, 2);
  const evaluation: Evaluation = {
    styleUsed: r.styles.some(s => s.key === m.style.key) ? m.style.key : r.styles[Math.min(1, r.styles.length - 1)].key,
    confidence: Math.min(1, Math.max(0, m.style.confidence)),
    band: overallBand(dimensions, redFlags),
    evidence: evidence.length ? evidence : sentences(input.text).slice(0, 2),
    flags,
    emailIntent: input.format === 'email' ? m.emailIntent ?? 'neutral' : undefined,
    usedVoice: input.usedVoice,
    dimensions,
    skills,
    redFlags
  };
  return { evaluation, droppedQuotes: dropped, adjustments, reasons };
}

export interface AnthropicEvaluatorOptions {
  transport: LlmTransport;
  settings: ModelSettings;
  logger?: AiLogger;
  repairRetries?: number;
  onAudit?(audit: EvaluationAudit, input: EvaluatorInput): void;
}

export function createAnthropicEvaluator(o: AnthropicEvaluatorOptions): Evaluator {
  const log = o.logger ?? silentLogger;

  async function evaluateWithAudit(input: EvaluatorInput, opts?: CallOptions) {
    const started = Date.now();
    const promptVersion = evaluatorPromptVersion(input.format);
    const base = { provider: 'anthropic' as const, promptVersion, model: o.settings.model, locale: input.locale ?? 'en' };
    const finish = (evaluation: Evaluation, extra: Partial<EvaluationAudit>) => {
      const audit: EvaluationAudit = { ...base, fallback: false, repaired: false, droppedQuotes: [], adjustments: [], reasons: {}, latencyMs: Date.now() - started, ...extra };
      o.onAudit?.(audit, input);
      return { evaluation, audit };
    };
    // Nothing to read: no model call.
    if (!input.text.trim()) return finish(await mockEvaluation(input), { adjustments: ['no participant words: heuristic only'] });

    const { req, resolved } = buildEvaluatorRequest(input, o.settings);
    try {
      const out = await structuredCall(o.transport, req, ModelEvaluation, {
        repairs: o.repairRetries ?? 1,
        repairPrompt: loadPrompt('repair').text,
        signal: opts?.signal,
        logger: log,
        check: v => {
          const issues: string[] = [];
          const want = resolved.dimensions.map(d => d.key);
          const got = v.dimensions.map(d => d.key);
          for (const k of want) if (!got.includes(k)) issues.push(`dimensions: missing ${k}`);
          for (const k of got) if (!want.includes(k)) issues.push(`dimensions: ${k} is not a rubric dimension`);
          if (new Set(got).size !== got.length) issues.push('dimensions: each key once');
          const skills = resolved.skills.map(s => s.key);
          for (const s of v.skills) if (!skills.includes(s.key)) issues.push(`skills: ${s.key} is not a listed skill`);
          if (!resolved.styles.some(s => s.key === v.style.key)) issues.push(`style: ${v.style.key} is not one of ${resolved.styles.map(s => s.key).join(', ')}`);
          return issues;
        }
      });
      const t = toEvaluation(out.value, input, resolved);
      if (t.droppedQuotes.length) log.warn('evaluator: quotes not found verbatim were dropped', { count: t.droppedQuotes.length, action: input.actionKey });
      return finish(t.evaluation, { model: out.result.model, repaired: out.repaired, droppedQuotes: t.droppedQuotes, adjustments: t.adjustments, reasons: t.reasons, usage: out.usage });
    } catch (e) {
      if (isAbort(e, opts?.signal)) throw e;
      log.error('evaluator: the model gave no usable answer; the heuristic evaluator answered', { error: String(e), action: input.actionKey, format: input.format });
      return finish(await mockEvaluation(input), { fallback: true, error: e instanceof RefusalError ? 'refusal' : String((e as Error).message ?? e) });
    }
  }

  return {
    provider: 'anthropic',
    evaluateWithAudit,
    evaluate: async (input, opts) => (await evaluateWithAudit(input, opts)).evaluation,
    reply: heuristicEvaluator.reply
  };
}
