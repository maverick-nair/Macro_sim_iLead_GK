import fs from 'node:fs';
import path from 'node:path';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';
import { copyViolations, formatDelta, sanitizeCopy } from './copy';
import { createI18n } from './index';

const dir = path.join(import.meta.dirname, 'messages');
const files = (locale: string) => fs.readdirSync(path.join(dir, locale)).filter(f => f.endsWith('.json'));
const read = (locale: string, f: string) => JSON.parse(fs.readFileSync(path.join(dir, locale, f), 'utf8')) as Record<string, string>;
const locales = fs.readdirSync(dir).filter(d => fs.statSync(path.join(dir, d)).isDirectory());
const catalogs = Object.fromEntries(locales.map(l => [l, Object.assign({}, ...files(l).map(f => read(l, f))) as Record<string, string>]));

/** The text a participant can actually see: literal parts of the message, through every plural and select branch. */
function visibleText(els: MessageFormatElement[]): string[] {
  const out: string[] = [];
  for (const el of els) {
    if (el.type === TYPE.literal) out.push(el.value);
    if (el.type === TYPE.select || el.type === TYPE.plural) for (const o of Object.values(el.options)) out.push(...visibleText(o.value));
    if (el.type === TYPE.tag) out.push(...visibleText(el.children));
  }
  return out;
}

describe('string catalog lint', () => {
  for (const [locale, messages] of Object.entries(catalogs)) {
    describe(locale, () => {
      it('parses as ICU', () => {
        for (const [k, m] of Object.entries(messages)) expect(() => parse(m), k).not.toThrow();
      });
      it('has no dash characters, emoji or "competency" in any visible text', () => {
        const bad = Object.entries(messages).flatMap(([k, m]) => visibleText(parse(m)).flatMap(t => copyViolations(t).map(v => `${k}: ${v} in "${t}"`)));
        expect(bad).toEqual([]);
      });
      it('defines each key in one file only, and every file is in the catalog index', () => {
        const seen = new Map<string, string>();
        const dupes = files(locale).flatMap(f => Object.keys(read(locale, f)).filter(k => { const d = seen.has(k); seen.set(k, f); return d; }));
        expect(dupes).toEqual([]);
        const index = fs.readFileSync(path.join(dir, locale, 'index.ts'), 'utf8');
        expect(files(locale).filter(f => !index.includes(`'./${f}'`))).toEqual([]);
      });
      it('has exactly the English keys', () => {
        expect(Object.keys(messages).sort()).toEqual(Object.keys(catalogs.en).sort());
      });
    });
  }
});

describe('copy rules', () => {
  it('flags dashes, emoji and competency', () => {
    expect(copyViolations('A quick check-in')).toEqual(['dash character U+002D']);
    expect(copyViolations('Well done — really')).toEqual(['dash character U+2014']);
    expect(copyViolations('Nice 🎉')).toEqual(['emoji']);
    expect(copyViolations('Core competencies')).toEqual(['says "competency", use "skills"']);
    expect(copyViolations('Trust −3, Morale +6')).toEqual([]);
  });

  it('sanitizes engine and AI text', () => {
    expect(sanitizeCopy('Morale -3')).toBe('Morale −3');
    expect(sanitizeCopy('Lifts Morale 6-10')).toBe('Lifts Morale 6 to 10');
    expect(sanitizeCopy('Book a follow-up')).toBe('Book a follow up');
    expect(sanitizeCopy('I hear you — let us talk')).toBe('I hear you, let us talk');
    expect(sanitizeCopy('I hear you - let us talk')).toBe('I hear you, let us talk');
    for (const s of ['Morale -3', 'a—b', 'x – y', 'well-known', 'pre‐made']) expect(copyViolations(sanitizeCopy(s))).toEqual([]);
  });

  it('formats deltas with a minus sign', () => {
    expect(formatDelta(8)).toBe('+8');
    expect(formatDelta(-2)).toBe('−2');
    expect(formatDelta(0.6)).toBe('+0.6');
    expect(formatDelta(0)).toBe('0');
  });

  it('never lets Intl put a hyphen in front of a number', () => {
    const { t, number } = createI18n();
    expect(t('reason.chip.numbers', { name: 'Kent', metric: 'Morale', delta: -2 })).toBe('Kent Morale −2');
    expect(number(-1200)).toBe('−1,200');
  });
});
