/**
 * `npm run tokens` writes the generated files. `npm run tokens -- --check` fails when they are
 * stale or when a declared contrast pair is below its WCAG minimum (used in CI and prebuild).
 */
import fs from 'node:fs';
import path from 'node:path';
import { build, type TokenSources } from './pipeline';

const root = path.resolve(import.meta.dirname, '../..');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, 'tokens', f), 'utf8'));
const src: TokenSources = { primitive: read('primitive.json'), semantic: read('semantic.json'), component: read('component.json'), legacy: read('legacy.json') };

const out = build(src);
const files: Record<string, string> = {
  'src/styles/tokens.generated.css': out.tokensCss,
  'src/styles/tailwind-theme.generated.css': out.tailwindCss,
  'src/styles/tokens.generated.ts': out.manifestTs
};

const failing = out.contrast.filter(c => !c.pass);
for (const c of out.contrast) console.log(`${c.pass ? 'pass' : 'FAIL'}  ${c.token} (${c.mode}) on ${c.against}: ${c.ratio}:1, needs ${c.min}:1`);

if (process.argv.includes('--check')) {
  const stale = Object.entries(files).filter(([f, body]) => !fs.existsSync(path.join(root, f)) || fs.readFileSync(path.join(root, f), 'utf8') !== body);
  if (stale.length) console.error(`Stale generated token files: ${stale.map(([f]) => f).join(', ')}. Run npm run tokens.`);
  if (stale.length || failing.length) process.exit(1);
} else {
  for (const [f, body] of Object.entries(files)) fs.writeFileSync(path.join(root, f), body);
  console.log(`Wrote ${Object.keys(files).length} files.`);
  if (failing.length) process.exit(1);
}
