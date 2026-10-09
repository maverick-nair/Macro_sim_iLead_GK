import * as lz from 'lz-string';
import type { Intent } from '../engine/contract';

/**
 * The resumable snapshot kept in the LMS's suspend data (D203). The engine is deterministic for a storyline
 * and a seed, so the run is its intent log: replayed on a fresh engine it rebuilds the very same run. The log
 * is compressed with lz-string into characters every LMS stores safely.
 *
 * `h` ties it to the storyline it was played on (the package's content hash): a package replaced in the LMS
 * by another version starts afresh instead of replaying intents into a different storyline. `p`, when set,
 * says the log was cut back to the start of that period to fit the LMS's limit.
 */
export interface Snapshot { v: 1; h: string; s: number; i: Intent[]; p?: number }

const PREFIX = 'il1:';
/** lz-string is CommonJS: Node hands it over as the default export, bundlers as named exports. */
const LZString = ((lz as unknown as { default?: typeof lz }).default ?? lz) as typeof lz;

export function encodeSnapshot(s: Snapshot): string {
  return PREFIX + LZString.compressToEncodedURIComponent(JSON.stringify(s));
}

export function decodeSnapshot(data: string | null | undefined): Snapshot | null {
  if (!data || !data.startsWith(PREFIX)) return null;
  try {
    const s = JSON.parse(LZString.decompressFromEncodedURIComponent(data.slice(PREFIX.length)) ?? 'null') as Snapshot | null;
    return s && s.v === 1 && typeof s.h === 'string' && typeof s.s === 'number' && Array.isArray(s.i) ? s : null;
  } catch {
    return null;
  }
}

/**
 * Where each period starts in the log: just after each `startNextPeriod`. A cut there resumes the run at
 * the start of that period, the state the participant last saw on the week end screen. Earliest first.
 */
export function periodStarts(log: Intent[]): Array<{ at: number; period: number }> {
  const out: Array<{ at: number; period: number }> = [];
  log.forEach((x, i) => { if (x.type === 'startNextPeriod') out.push({ at: i + 1, period: out.length + 2 }); });
  return out;
}

export type Fit = { data: string; kept: number; mode: 'full' | 'period' | 'none'; period?: number };

/**
 * The longest snapshot that fits `limit` characters (D203): the whole log; else the log up to the latest
 * period start that fits, so the participant resumes at the start of that period; else an empty log (the
 * run starts again, while the LMS keeps the status and score already reported). SCORM 1.2's 4096 characters
 * hold a few weeks of conversations; SCORM 2004's 64000 hold a whole run.
 */
export function fitSnapshot(base: Omit<Snapshot, 'i' | 'p' | 'v'>, log: Intent[], limit: number): Fit {
  const full = encodeSnapshot({ v: 1, ...base, i: log });
  if (full.length <= limit) return { data: full, kept: log.length, mode: 'full' };
  for (const b of periodStarts(log).reverse()) {
    if (b.at >= log.length) continue;
    const data = encodeSnapshot({ v: 1, ...base, i: log.slice(0, b.at), p: b.period });
    if (data.length <= limit) return { data, kept: b.at, mode: 'period', period: b.period };
  }
  return { data: encodeSnapshot({ v: 1, ...base, i: [], p: 1 }), kept: 0, mode: 'none' };
}
