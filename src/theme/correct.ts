/**
 * Automatic contrast correction for a client theme (D72).
 *
 * Every pair the token build checks (tokens/contrast.json and the `contrast` declared on semantic
 * tokens) is measured again with the theme's colours, in light and dark, with the build's own painter
 * (paint.ts) and maths (color.ts). A pair below its WCAG minimum is fixed by moving the lightness of
 * the theme colour involved: the foreground when the theme set it, otherwise the background, otherwise
 * the base layer. Hue and chroma stay; chroma drops only as far as the sRGB gamut needs at the new
 * lightness. The search takes the smallest lightness change that passes, lighter or darker.
 *
 * A colour no lightness can fix (it conflicts with another pair) is dropped, so that token keeps
 * the iLead default, which the build has already checked.
 */
import { formatOklch, toGamut, toRgb, type Oklch } from './color';
import { createPainter, measure, pairModes, pairTargets, round2, worst, type ContrastPair, type Mode, type Painter, type TokenNode } from './paint';

/** One colour a theme sets: a whole token, or one stop of the brand gradient, in one mode. */
export interface Slot {
  token: string;
  mode: Mode;
  /** Gradient stop index; 0 for a plain colour. */
  stop: number;
  /** The CSS text the theme gave, written back unchanged when no correction was needed. */
  source: string;
  color: Oklch;
  corrected: boolean;
}

export interface Correction {
  token: string;
  mode: Mode;
  stop: number;
  from: string;
  to: string;
  /** The pair that needed it: "color.accent.secondary on color.surface.raised, 3.1:1 needs 4.5:1". */
  because: string;
}

export interface CorrectionResult {
  corrections: Correction[];
  /** Tokens dropped back to the default because no lightness passes every pair. */
  dropped: string[];
}

export interface Table { pairs: ContrastPair[]; nodes: Record<string, TokenNode> }

const slotId = (s: Pick<Slot, 'token' | 'mode' | 'stop'>) => `${s.token}|${s.mode}|${s.stop}`;
/** A little headroom over the minimum, so rounding the written colour to 4 decimals cannot tip it under. */
const MARGIN = 0.03;

/**
 * Corrects `slots` in place (by token, then mode, then gradient stop) and reports what changed.
 * Tokens in `dropped` were removed from `slots`.
 */
export function correctContrast(table: Table, slots: Map<string, Record<Mode, Slot[]>>): CorrectionResult {
  const byId = new Map<string, Slot>();
  const index = () => {
    byId.clear();
    for (const modes of slots.values()) for (const list of Object.values(modes)) for (const s of list) byId.set(slotId(s), s);
  };
  index();
  const painter: Painter = createPainter(p => table.nodes[p], (path, mode) => slots.get(path)?.[mode]?.map(s => ({ rgb: toRgb(s.color), slot: slotId(s) })));
  const corrections = new Map<string, Correction>();
  const dropped: string[] = [];

  const failures = (mode: Mode) => {
    const out: Array<{ pair: ContrastPair; against: string; ratio: number; slots: string[] }> = [];
    for (const pair of table.pairs) {
      if (!pairModes(pair).includes(mode)) continue;
      for (const against of pairTargets(pair)) {
        const combos = measure(painter, pair, against, mode);
        const bad = combos.filter(c => c.ratio < pair.min);
        // Only failures a theme colour takes part in: the defaults pass by construction (token build).
        const ours = bad.filter(c => c.fg.slot || c.bg.slot || c.base.slot);
        if (!ours.length) continue;
        const ids = new Set<string>();
        for (const c of ours) for (const id of [c.fg.slot, c.bg.slot, c.base.slot]) if (id) ids.add(id);
        out.push({ pair, against, ratio: worst(combos), slots: [...ids] });
      }
    }
    return out;
  };

  /** Moves one slot's lightness until the pair passes on every combination it takes part in. */
  const fix = (slot: Slot, pair: ContrastPair, against: string): boolean => {
    const id = slotId(slot);
    const ratio = () => worst(measure(painter, pair, against, slot.mode).filter(c => c.fg.slot === id || c.bg.slot === id || c.base.slot === id));
    const target = pair.min + MARGIN;
    const was = ratio();
    const orig = slot.color;
    const at = (l: number) => { slot.color = toGamut({ ...orig, l }); };
    let best: number | null = null;
    for (const end of [1, 0]) {
      at(end);
      if (ratio() < target) continue;
      let lo = orig.l, hi = end;
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        at(mid);
        if (ratio() >= target) hi = mid; else lo = mid;
      }
      if (best === null || Math.abs(hi - orig.l) < Math.abs(best - orig.l)) best = hi;
    }
    if (best === null) { slot.color = orig; return false; }
    at(best);
    slot.corrected = true;
    const prev = corrections.get(id);
    corrections.set(id, {
      token: slot.token, mode: slot.mode, stop: slot.stop, from: prev?.from ?? slot.source, to: formatOklch(slot.color),
      because: prev?.because ?? `${pair.fg} on ${against}, ${round2(was)}:1 needs ${pair.min}:1`
    });
    return true;
  };

  for (let round = 0; round < 6; round++) {
    for (const mode of ['light', 'dark'] as const) {
      for (let pass = 0; pass < 8; pass++) {
        const failing = failures(mode);
        if (!failing.length) break;
        for (const f of failing) {
          // Foreground first, then background, then the base layer: the order the pair names them.
          const fgSide = f.slots.filter(id => byId.get(id)?.token && painterSide(f.pair.fg, id));
          const order = [...fgSide, ...f.slots.filter(id => !fgSide.includes(id))];
          for (const id of order) {
            const slot = byId.get(id);
            if (!slot) continue;
            if (fix(slot, f.pair, f.against)) break;
          }
        }
      }
    }
    // Whatever still fails cannot be fixed by lightness: drop the theme colours involved.
    const stuck = [...failures('light'), ...failures('dark')];
    if (!stuck.length) break;
    for (const f of stuck) for (const id of f.slots) {
      const token = byId.get(id)?.token;
      if (token && slots.delete(token)) dropped.push(token);
    }
    for (const id of [...corrections.keys()]) if (!slots.has(id.split('|')[0])) corrections.delete(id);
    index();
  }

  /** True when the slot belongs to a token the pair's foreground resolves through. */
  function painterSide(fg: string, id: string): boolean {
    const token = id.split('|')[0];
    const seen = new Set<string>();
    const walk = (p: string): boolean => {
      if (p === token) return true;
      if (seen.has(p)) return false;
      seen.add(p);
      const n = table.nodes[p];
      if (!n) return false;
      const refs: string[] = [];
      for (const v of [n.$value, n.value, n.light, n.dark]) {
        if (typeof v === 'string') for (const m of v.matchAll(/\{([a-z0-9.-]+)\}/gi)) refs.push(m[1]);
        else if (v) refs.push(v.ref);
      }
      return refs.some(walk);
    };
    return walk(fg);
  }

  return { corrections: [...corrections.values()], dropped };
}

/** Measures the theme as it stands: the worst ratio of every pair it takes part in, for tests and the report. */
export function auditTheme(table: Table, slots: Map<string, Record<Mode, Slot[]>>): Array<{ fg: string; against: string; mode: Mode; ratio: number; min: number; pass: boolean }> {
  const painter = createPainter(p => table.nodes[p], (path, mode) => slots.get(path)?.[mode]?.map(s => ({ rgb: toRgb(s.color), slot: slotId(s) })));
  const out: Array<{ fg: string; against: string; mode: Mode; ratio: number; min: number; pass: boolean }> = [];
  for (const pair of table.pairs) for (const against of pairTargets(pair)) for (const mode of pairModes(pair)) {
    const combos = measure(painter, pair, against, mode);
    const ratio = round2(worst(combos));
    out.push({ fg: pair.fg, against, mode, ratio, min: pair.min, pass: ratio >= pair.min });
  }
  return out;
}
