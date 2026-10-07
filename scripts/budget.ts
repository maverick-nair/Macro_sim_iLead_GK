import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Performance budget (brief): the main board's initial JS must stay under 250KB gzipped (200KB until
 * D79, 2026-10-07). Initial JS is the entry script plus the chunks it imports statically (modulepreload links), not lazy chunks.
 */
const BUDGET_KB = 250;
const dist = path.resolve('dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const files = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map(m => m[1]);
const sizes = files.map(f => ({ f, kb: zlib.gzipSync(fs.readFileSync(path.join(dist, f)), { level: 9 }).length / 1024 }));
const total = sizes.reduce((a, s) => a + s.kb, 0);
for (const s of sizes) console.log(`${s.kb.toFixed(1).padStart(7)} KB  ${s.f}`);
console.log(`${total.toFixed(1).padStart(7)} KB  initial JS, budget ${BUDGET_KB} KB`);
if (total > BUDGET_KB) {
  console.error(`Over budget by ${(total - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
