/**
 * WCAG contrast checks for the token build.
 *
 * Any token (primitive, semantic or component) can be checked against any other. The maths and the
 * token resolution live in src/theme/paint.ts and src/theme/color.ts, shared with the runtime theme
 * loader, which corrects a client theme against these same pairs (DECISIONS D71). Client themes are
 * no longer a build time variant: the build checks the default theme in light and dark.
 */
import { createPainter, measure, pairModes, pairTargets, PaintError, round2, worst, type ContrastPair, type TokenNode } from '../../src/theme/paint';
import { TokenError, type Leaf } from './pipeline';

export type { ContrastPair };
export type Mode = 'light' | 'dark';

export interface ContrastResult { token: string; mode: string; against: string; ratio: number; min: number; pass: boolean; why?: string }

export function contrastChecks(pairs: ContrastPair[], layers: { prim: Leaf[]; sem: Leaf[]; comp: Leaf[] }): ContrastResult[] {
  const byPath = new Map<string, TokenNode>();
  for (const l of [...layers.prim, ...layers.sem, ...layers.comp]) byPath.set(l.path, l.node as TokenNode);
  const painter = createPainter(p => byPath.get(p));
  const out: ContrastResult[] = [];
  try {
    for (const pair of pairs) {
      for (const against of pairTargets(pair)) {
        for (const mode of pairModes(pair)) {
          const ratio = round2(worst(measure(painter, pair, against, mode)));
          out.push({ token: pair.fg, mode, against, ratio, min: pair.min, pass: ratio >= pair.min, ...(pair.why ? { why: pair.why } : null) });
        }
      }
    }
  } catch (e) {
    if (e instanceof PaintError) throw new TokenError(e.message);
    throw e;
  }
  return out;
}
