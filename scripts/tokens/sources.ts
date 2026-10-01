import fs from 'node:fs';
import path from 'node:path';
import { TokenError, type TokenSources } from './pipeline';

/** Deep merges token trees. Two files defining the same path is an error, so parallel edits stay safe. */
export function mergeTrees(trees: Array<{ file: string; tree: Record<string, unknown> }>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const owner = new Map<string, string>();
  const walk = (dst: Record<string, unknown>, src: Record<string, unknown>, file: string, base: string) => {
    for (const [k, v] of Object.entries(src)) {
      if (k.startsWith('$')) continue;
      const p = base ? `${base}.${k}` : k;
      const isLeaf = v !== null && typeof v === 'object' && ('$value' in v || 'value' in v || 'light' in v);
      if (isLeaf || v === null || typeof v !== 'object') {
        if (owner.has(p)) throw new TokenError(`${p} is defined in both ${owner.get(p)} and ${file}`);
        owner.set(p, file);
        dst[k] = v;
      } else {
        if (owner.has(p)) throw new TokenError(`${p} is a token in ${owner.get(p)} and a group in ${file}`);
        dst[k] = dst[k] ?? {};
        walk(dst[k] as Record<string, unknown>, v as Record<string, unknown>, file, p);
      }
    }
  };
  for (const t of trees) walk(out, t.tree, t.file, '');
  return out;
}

function readLayer(dir: string): Record<string, unknown> {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  return mergeTrees(files.map(f => ({ file: path.join(path.basename(dir), f), tree: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) })));
}

/** Loads tokens/primitive/*.json, tokens/semantic/*.json, tokens/component/*.json and tokens/legacy.json. */
export function loadSources(root: string): TokenSources {
  const t = path.join(root, 'tokens');
  return {
    primitive: readLayer(path.join(t, 'primitive')),
    semantic: readLayer(path.join(t, 'semantic')),
    component: readLayer(path.join(t, 'component')),
    legacy: JSON.parse(fs.readFileSync(path.join(t, 'legacy.json'), 'utf8'))
  };
}
