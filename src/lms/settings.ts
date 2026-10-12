import { DEFAULT_LMS as STORYLINE_LMS } from '../engine/config';
import { DEFAULT_SCALE } from '../engine/report/defaults';

/**
 * What an LMS records for a run, and when (D201). The storyline carries these as `StorylineConfig.lms` (D184),
 * authored in GenieKreator's Review and publish; this is the runtime's form of that block, and every reader
 * goes through `lmsSettingsOf`, which reads `config.lms` defensively. The defaults are the storyline's.
 */
export type ScormVersion = 'scorm12' | 'scorm2004';

export type CompletionRule = { kind: 'finish' } | { kind: 'weeks'; weeks: number };
/** `score`: the Leadership Score on a 0 to 100 scale; `level`: the report's overall level index on the rating scale. */
export type PassRule = { kind: 'none' } | { kind: 'score'; min: number } | { kind: 'level'; min: number };

export interface LmsSettings {
  version: ScormVersion;
  completion: CompletionRule;
  pass: PassRule;
  /** Connected mode (D206): off by default; the package then plays fully offline. */
  connected: boolean;
}

/** The storyline's defaults (`DEFAULT_LMS` in src/engine/config.ts) in this form. */
export const DEFAULT_LMS: LmsSettings = { version: STORYLINE_LMS.package, completion: { kind: 'finish' }, pass: { kind: 'none' }, connected: STORYLINE_LMS.connected };

const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? v as Record<string, unknown> : {});

/**
 * Any value to valid settings: unknown or out of range parts fall back to the defaults. Accepts the
 * nested form above and the flat form a schema may choose (`completion: 'weeks', weeks: 4`).
 */
export function normalizeLms(raw: unknown): LmsSettings {
  const r = obj(raw);
  const version: ScormVersion = r.version === 'scorm12' || r.version === 'scorm2004' ? r.version : DEFAULT_LMS.version;
  const c = typeof r.completion === 'string' ? { kind: r.completion, weeks: r.weeks } : obj(r.completion);
  const completion: CompletionRule = c.kind === 'weeks' ? { kind: 'weeks', weeks: int(c.weeks, 1, 52, 1) } : { kind: 'finish' };
  const p = typeof r.pass === 'string' ? { kind: r.pass, min: r.min ?? r.threshold } : obj(r.pass);
  const pass: PassRule = p.kind === 'score' ? { kind: 'score', min: int(p.min ?? p.threshold, 0, 100, 70) }
    : p.kind === 'level' ? { kind: 'level', min: int(p.min, 0, 6, 2) } : { kind: 'none' };
  return { version, completion, pass, connected: r.connected === true };
}

/**
 * The storyline's LMS settings, or the defaults. Reads the authored block (`StorylineConfig.lms`, D184: `completion
 * { rule, periods? }`, `pass { rule, score, level? }`, `package`, `connected`) without trusting its shape: completing
 * by weeks with no number means every period of the run, and a pass level is found by name on the storyline's
 * rating scale (`report.scale`, or the default scale). A block in this module's own form (nested or flat) is read too.
 */
export function lmsSettingsOf(config: unknown): LmsSettings {
  const c = obj(config);
  const l = obj(c.lms);
  const completion = obj(l.completion), pass = obj(l.pass);
  const authored = typeof l.package === 'string' || typeof completion.rule === 'string' || typeof pass.rule === 'string';
  if (!authored) return normalizeLms(c.lms);
  const periods = completion.periods ?? obj(obj(c.time).period).count;
  const scale = (Array.isArray(obj(c.report).scale) ? obj(c.report).scale as unknown[] : DEFAULT_SCALE).map(x => obj(x).name);
  const level = typeof pass.level === 'string' ? scale.findIndex(n => typeof n === 'string' && n.trim() === (pass.level as string).trim()) : -1;
  return normalizeLms({
    version: l.package,
    completion: completion.rule === 'weeks' ? { kind: 'weeks', weeks: periods } : { kind: 'finish' },
    pass: pass.rule === 'score' ? { kind: 'score', min: pass.score } : pass.rule === 'level' ? { kind: 'level', min: level >= 0 ? level : undefined } : { kind: 'none' },
    connected: l.connected
  });
}
