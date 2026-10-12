/**
 * What an LMS records for a run, and when (D201). The storyline will carry these as `StorylineConfig.lms`
 * (another workstream adds the block to src/engine/config.ts); until then this is the type and its
 * defaults, and every reader goes through `lmsSettingsOf`, which reads `config.lms` defensively, so wiring
 * the schema in later is one line.
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

export const DEFAULT_LMS: LmsSettings = { version: 'scorm2004', completion: { kind: 'finish' }, pass: { kind: 'none' }, connected: false };

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

/** The storyline's LMS settings, or the defaults. Reads `config.lms` without trusting its shape. */
export function lmsSettingsOf(config: unknown): LmsSettings {
  // When `lms` joins StorylineConfig this stays as is: the schema's defaults and this agree.
  return normalizeLms((config as { lms?: unknown } | null | undefined)?.lms);
}
