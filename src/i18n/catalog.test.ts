import fs from 'node:fs';
import path from 'node:path';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';
import { copyViolations, formatDelta, sanitizeCopy } from './copy';
import { createI18n } from './index';
import { pseudoCatalog } from './pseudo';

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
        // engine.json loads on its own beside the first view (src/i18n/locales.ts).
        const index = fs.readFileSync(path.join(dir, locale, 'index.ts'), 'utf8') + fs.readFileSync(path.join(dir, '..', 'locales.ts'), 'utf8');
        expect(files(locale).filter(f => !index.includes(`'./${f}'`) && !index.includes(`'./messages/${locale}/${f}'`))).toEqual([]);
      });
      if (locale !== 'en') {
        // Another language may leave keys out (they fall back to English one by one), never add its own, and
        // reads only arguments the English message has (it may not need them all: Spanish needs no pronoun).
        it('has only English keys, reading only their arguments', () => {
          expect(Object.keys(messages).filter(k => !(k in catalogs.en))).toEqual([]);
          const diff = Object.entries(messages).filter(([k, m]) => args(parse(m)).some(a => !args(parse(catalogs.en[k])).includes(a))).map(([k]) => k);
          expect(diff).toEqual([]);
        });
        it('words every engine code (engine.json is complete)', () => {
          expect(Object.keys(read(locale, 'engine.json')).sort()).toEqual(Object.keys(read('en', 'engine.json')).sort());
        });
      }
    });
  }

  // A pronoun select reads the person's pronoun itself (he, she, they) and says they when it is not stated (D145).
  it('selects pronouns on he and she, with they for anything else', () => {
    const selects = (els: MessageFormatElement[]): string[][] => els.flatMap(el => {
      if (el.type === TYPE.select) return [...(el.value === 'pronoun' ? [Object.keys(el.options)] : []), ...Object.values(el.options).flatMap(o => selects(o.value))];
      if (el.type === TYPE.plural) return Object.values(el.options).flatMap(o => selects(o.value));
      return el.type === TYPE.tag ? selects(el.children) : [];
    });
    const found = Object.entries(catalogs.en).flatMap(([k, m]) => selects(parse(m)).map(keys => [k, keys] as const));
    expect(found.length).toBeGreaterThan(0);
    for (const [k, keys] of found) {
      expect(keys, k).toEqual(expect.arrayContaining(['he', 'she', 'other']));
      expect(keys.filter(x => !['he', 'she', 'they', 'other'].includes(x)), k).toEqual([]);
    }
    const { tk } = createI18n('en');
    expect(tk('engine.report.bottleneckWhy', { name: 'Beth', stat: 'morale', value: 3, pronoun: 'she' })).toMatch(/of her numbers\.$/);
    expect(tk('engine.report.bottleneckWhy', { name: 'Sam', stat: 'morale', value: 3, pronoun: 'they' })).toMatch(/of their numbers\.$/);
    expect(tk('engine.erratic.cause', { name: 'Sam', pronoun: 'unknown' })).toMatch(/what they need had not changed/);
  });

  // The pseudo locales (D83) are built from English at run time: the same rules hold for what they show.
  for (const tag of ['en-XA', 'ar-XB']) {
    it(`${tag} parses and keeps to the copy rules`, () => {
      const pseudo = pseudoCatalog(catalogs.en, tag);
      const bad = Object.entries(pseudo).flatMap(([k, m]) => visibleText(parse(m)).flatMap(t => copyViolations(t).map(v => `${k}: ${v}`)));
      expect(bad).toEqual([]);
      expect(Object.entries(pseudo).filter(([k, m]) => args(parse(m)).join() !== args(parse(catalogs.en[k])).join())).toEqual([]);
    });
  }
});

/** The arguments a message reads, sorted. */
function args(els: MessageFormatElement[]): string[] {
  const out = new Set<string>();
  const walk = (list: MessageFormatElement[]) => {
    for (const el of list) {
      if ('value' in el && el.type !== TYPE.literal && typeof el.value === 'string') out.add(el.value);
      if (el.type === TYPE.select || el.type === TYPE.plural) for (const o of Object.values(el.options)) walk(o.value);
      if (el.type === TYPE.tag) { out.add(el.value); walk(el.children); }
    }
  };
  walk(els);
  return [...out].sort();
}

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

  it('removes emoji, look alike dashes and "competency" from generated text', () => {
    expect(sanitizeCopy('Great job 🎉')).toBe('Great job');
    expect(sanitizeCopy('Well done 👍🏽!')).toBe('Well done!');
    expect(sanitizeCopy('Core competencies matter')).toBe('Core skills matter');
    expect(sanitizeCopy('Q3–Q4 plan')).toBe('Q3 to Q4 plan');
    for (const s of ['a ⁃ b', 'line ─ here', 'x ˗ y', 'full－width']) {
      expect(copyViolations(s).length).toBeGreaterThan(0);
      expect(copyViolations(sanitizeCopy(s))).toEqual([]);
    }
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
