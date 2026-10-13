import { describe, expect, it } from 'vitest';
import { createI18n } from '../i18n';
import { wordAll as en } from '../i18n/engineCopy';
import { engineReport } from '../components/board/EngineWeekEnd';
import { endScreenProps } from '../components/board/EngineEnd';
import { parseStoryline, type StorylineConfig, type StorylineInput } from './config';
import { EngineView } from './contract';
import { parseReport } from './reportContract';
import { msg } from './copy';
import { play } from './sim/policies';
import salesElevator from './storylines/sales-elevator.json';
import { unitParams, unitWords, withArticle } from './units';

/**
 * The sales unit (D227): a storyline that names what one conversion is ("outlet order") has it in the participant's
 * copy where conversions are counted; one that does not reads exactly as before.
 */
const raw = salesElevator as unknown as StorylineInput;
const parse = (input: unknown): StorylineConfig => { const p = parseStoryline(input); if (!p.ok) throw new Error(p.issues.join('\n')); return p.config; };
const ORDER = parse({ ...raw, money: { ...raw.money, unit: { one: 'outlet order', other: 'outlet orders' } } });
const PLAIN = parse(raw);
const i18n = createI18n();

describe('the sales unit (D227)', () => {
  it('words the unit with its article, or the catalog\'s word when there is none', () => {
    expect(withArticle('outlet order')).toBe('an outlet order');
    expect(withArticle('distributor bill')).toBe('a distributor bill');
    expect(en(unitParams(null))).toEqual({ unitOne: 'deal', unitMany: 'deals', UnitMany: 'Deals', aUnit: 'a deal' });
    expect(unitWords(i18n.t, { one: 'outlet order', other: 'outlet orders' })).toEqual({ unitOne: 'outlet order', unitMany: 'outlet orders', UnitMany: 'Outlet orders', aUnit: 'an outlet order', custom: 'yes' });
  });

  it('names the unit in the first close badge, the report, the end screen and the week end', async () => {
    for (const [config, one, many, Many, label] of [[ORDER, 'outlet order', 'outlet orders', 'Outlet orders', 'Outlet orders'], [PLAIN, 'deal', 'deals', 'Deals', 'Conversions']] as const) {
      const { view } = await play(config, 'good', 3);
      const v = en(EngineView.parse(view));
      const badge = v.badges.find(b => b.rule === 'first_close')!;
      expect(badge.reason).toBe(`Your team closed its first ${one}.`);
      expect(badge.description).toBe(`Your team converts its first ${one}.`);
      expect(v.money.unit).toEqual(config === ORDER ? { one, other: many } : null);
      const report = parseReport(view.report);
      expect(en(report.summary.business)).toMatch(new RegExp(`with \\d+ ${many}`));
      const end = endScreenProps(i18n, EngineView.parse(view), report);
      expect(end.results.conversionsLabel).toBe(label);
      const week = engineReport(i18n, EngineView.parse(view), EngineView.parse(view).periods[0]);
      expect(week.scoreParts?.at(-1)).toMatch(new RegExp(`^${Many} closed: `));
    }
  });

  it('asks interview candidates about the unit', () => {
    expect(en(msg('engine.interview.q1', { aUnit: unitParams(ORDER.money.unit).aUnit }))).toBe('Tell me about an outlet order you lost. What happened, and what did you do next?');
    expect(en(msg('engine.interview.q1', { aUnit: unitParams(PLAIN.money.unit).aUnit }))).toBe('Tell me about a deal you lost. What happened, and what did you do next?');
  });
});
