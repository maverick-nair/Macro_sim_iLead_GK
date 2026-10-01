import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Components may only use tokens and the string catalog. Stories and tests are exempt (they hold
 * fixture data). Screens are exempt until their milestone migrates them.
 */
const dir = import.meta.dirname;
const files = fs.readdirSync(dir, { recursive: true, encoding: 'utf8' })
  .filter(f => /\.tsx?$/.test(f) && !/\.(stories|test)\.tsx?$/.test(f))
  .map(f => path.join(dir, f));

const RULES: Array<[string, RegExp]> = [
  ['hex color', /#[0-9a-fA-F]{3,8}\b/],
  ['color function', /\b(oklch|rgba?|hsla?|lab|lch|color-mix)\(/],
  ['pixel value', /\d(px|rem|em)\b/],
  ['arbitrary Tailwind value', /\w-\[[^\]]+\]/],
  ['legacy css() helper', /\bcss\(/],
  ['legacy --ik variable', /--ik-/],
  ['numeric style value', /\b(fontSize|fontWeight|padding\w*|margin\w*|gap|width|height|top|left|right|bottom|borderRadius|lineHeight)\s*:\s*['"]?\d/],
  ['inline JSX text', /(["'}\w]|<\w+)>\s*[^<>{}\s][^<>{}]*[A-Za-z][^<>{}]*<\/?[A-Za-z]/],
  ['literal user facing attribute', /\b(aria-label|title|placeholder|alt)="[^"]+"/]
];

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('components use tokens and the string catalog only', () => {
  it('found component files', () => expect(files.length).toBeGreaterThan(0));
  for (const file of files) {
    it(path.relative(dir, file), () => {
      const src = strip(fs.readFileSync(file, 'utf8'));
      const hits = src.split('\n').flatMap((line, i) => RULES.filter(([, rx]) => rx.test(line)).map(([name]) => `line ${i + 1}: ${name}: ${line.trim().slice(0, 120)}`));
      expect(hits).toEqual([]);
    });
  }
});
