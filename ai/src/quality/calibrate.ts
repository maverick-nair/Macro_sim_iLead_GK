import { z } from 'zod';
import { BANDS, type StorylineConfig } from '../../../src/engine/config';
import { localeOf } from '../scene';
import type { Band, Evaluator, EvaluatorInput } from '../types';

/**
 * Rubric calibration (iLead 2.0 Design, quality gate 2): every rubric is scored on authored sample
 * answers, and it passes when the evaluator's overall band matches the author's label on at least 85%
 * of the samples. Agreement is reported per action (each live action has its own rubric) and overall.
 */

export const CalibrationSet = z.object({
  storyline: z.string(),
  version: z.number().int(),
  about: z.string().optional(),
  actions: z.record(z.string(), z.object({
    counterpart: z.string().nullable(),
    samples: z.array(z.object({ id: z.string(), band: z.enum(BANDS), text: z.string().min(1) })).min(1)
  }))
});
export type CalibrationSet = z.infer<typeof CalibrationSet>;

export const THRESHOLD = 0.85;
const SPONSOR_ACTION = { key: 'sponsor', name: 'Sponsor briefing', format: 'sponsor' };

/** The evaluator input for one sample, built from the storyline as the server would build it. */
export function sampleInput(config: StorylineConfig, actionKey: string, counterpart: string | null, text: string): EvaluatorInput {
  const action = config.actions.find(a => a.key === actionKey);
  const format = action?.format ?? (actionKey === 'sponsor' ? SPONSOR_ACTION.format : 'roleplay');
  const person = counterpart ? [...config.members, ...config.candidates].find(p => p.id === counterpart) : undefined;
  const rubric = action?.live.rubric;
  const skills = config.report.linkage[actionKey] ?? [];
  return {
    format,
    text,
    locale: localeOf(config),
    actionKey,
    actionName: action?.name ?? SPONSOR_ACTION.name,
    goal: action?.live.goal,
    rubric: rubric?.map(r => ({ key: r.key })),
    rubricLabels: rubric ? Object.fromEntries(rubric.map(r => [r.key, r.label])) : undefined,
    skills,
    skillDefs: config.report.skills.filter(s => skills.includes(s.key)).map(s => ({ key: s.key, name: s.name, anchors: s.anchors, description: s.description })),
    styles: config.lens.styles.map(s => ({ key: s.key, name: s.name, short: s.short })),
    counterpart: person ? { name: person.name, title: person.title, hiddenConcern: person.hiddenConcern } : counterpart === 'sponsor' ? { name: config.sponsor.name, title: config.sponsor.title } : undefined
  };
}

export interface CalibrationMiss { id: string; expected: Band; got: Band; fallback: boolean }
export interface ActionResult { action: string; format: string; agree: number; adjacent: number; total: number; pct: number; pass: boolean; misses: CalibrationMiss[] }
export interface CalibrationReport {
  provider: string;
  promptVersions: string[];
  threshold: number;
  actions: ActionResult[];
  overall: { agree: number; adjacent: number; total: number; pct: number };
  /** Evaluations the mock answered because the model failed: they count, and they are listed. */
  fallbacks: number;
  pass: boolean;
}

const RANK: Record<Band, number> = { harmful: 0, weak: 1, adequate: 2, strong: 3 };

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

export async function runCalibration(evaluator: Evaluator, set: CalibrationSet, config: StorylineConfig, o: { threshold?: number; concurrency?: number; onSample?(id: string, expected: Band, got: Band): void } = {}): Promise<CalibrationReport> {
  const threshold = o.threshold ?? THRESHOLD;
  const versions = new Set<string>();
  let fallbacks = 0;
  const actions: ActionResult[] = [];
  for (const [action, spec] of Object.entries(set.actions)) {
    const results = await pool(spec.samples, o.concurrency ?? 4, async s => {
      const input = sampleInput(config, action, spec.counterpart, s.text);
      const { evaluation, audit } = await evaluator.evaluateWithAudit(input);
      versions.add(audit.promptVersion);
      if (audit.fallback) fallbacks++;
      o.onSample?.(s.id, s.band, evaluation.band);
      return { s, got: evaluation.band, fallback: audit.fallback, format: input.format };
    });
    const agree = results.filter(r => r.got === r.s.band).length;
    const adjacent = results.filter(r => Math.abs(RANK[r.got] - RANK[r.s.band]) <= 1).length;
    const pct = agree / results.length;
    actions.push({
      action, format: results[0]?.format ?? '', agree, adjacent, total: results.length, pct, pass: pct >= threshold,
      misses: results.filter(r => r.got !== r.s.band).map(r => ({ id: r.s.id, expected: r.s.band, got: r.got, fallback: r.fallback }))
    });
  }
  const agree = actions.reduce((a, r) => a + r.agree, 0);
  const adjacent = actions.reduce((a, r) => a + r.adjacent, 0);
  const total = actions.reduce((a, r) => a + r.total, 0);
  return {
    provider: evaluator.provider, promptVersions: [...versions].sort(), threshold, actions,
    overall: { agree, adjacent, total, pct: total ? agree / total : 0 }, fallbacks,
    pass: actions.every(a => a.pass)
  };
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export function formatCalibration(r: CalibrationReport): string {
  const lines = [`Rubric calibration (${r.provider}), pass at ${pct(r.threshold)} per action`, `Prompt versions: ${r.promptVersions.join(', ')}`, ''];
  lines.push('action     format     agree   exact    within one band  result');
  for (const a of r.actions) {
    lines.push(`${a.action.padEnd(10)} ${a.format.padEnd(10)} ${`${a.agree}/${a.total}`.padEnd(7)} ${pct(a.pct).padEnd(8)} ${pct(a.adjacent / a.total).padEnd(16)} ${a.pass ? 'pass' : 'FAIL'}`);
    for (const m of a.misses) lines.push(`             ${m.id}: labelled ${m.expected}, rated ${m.got}${m.fallback ? ' (heuristic fallback)' : ''}`);
  }
  lines.push('', `Overall ${r.overall.agree}/${r.overall.total} (${pct(r.overall.pct)}), within one band ${pct(r.overall.adjacent / Math.max(1, r.overall.total))}${r.fallbacks ? `, ${r.fallbacks} heuristic fallbacks` : ''}`);
  lines.push(r.pass ? 'PASS' : 'FAIL: at least one rubric agrees on fewer than the threshold');
  return lines.join('\n');
}
