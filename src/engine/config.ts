import { z } from 'zod';

/**
 * Storyline configuration authored in GenieKreator. The engine only runs on a config that passes
 * this schema; the authoring tool shows the issues it reports. Rules: docs/SIMULATION.md section 1.
 */

const Score = z.number().int().min(0).max(100);
const Ratio = z.number().min(0).max(1);

/** ISO 4217 code known to the runtime, for example USD, GBP, JPY, SGD, INR, MYR, AED. */
const KNOWN_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));
const CurrencyCode = z.string().regex(/^[A-Z]{3}$/, 'Use a three letter ISO 4217 code').refine(code => KNOWN_CURRENCIES.has(code), 'Unknown currency code');

const Locale = z.string().min(2).refine(l => {
  try {
    return Intl.NumberFormat.supportedLocalesOf([l]).length > 0;
  } catch {
    return false;
  }
}, 'Unsupported locale');

/** Currencies offered in the authoring tool. Any valid ISO 4217 code is accepted. */
export const SUGGESTED_CURRENCIES = ['USD', 'GBP', 'EUR', 'JPY', 'SGD', 'INR', 'MYR', 'AED', 'IDR', 'THB', 'PHP', 'VND', 'AUD', 'CNY', 'SAR'] as const;

export const Money = z.object({
  currency: CurrencyCode,
  locale: Locale,
  display: z.enum(['symbol', 'narrowSymbol', 'code']).default('symbol'),
  target: z.number().positive(),
  valuePerConversion: z.number().positive(),
  /** New leads entering the first stage each sub-period, one value per period. */
  inputPerSubPeriod: z.array(z.number().nonnegative()).min(1)
});

export const PERIOD_UNITS = ['year', 'month', 'week', 'day'] as const;
export const SUB_PERIOD_UNITS = ['quarter', 'month', 'week', 'day', 'hour'] as const;

/** Default sub-period unit and count for each period unit. */
export const SUB_PERIOD_DEFAULTS: Record<(typeof PERIOD_UNITS)[number], { unit: (typeof SUB_PERIOD_UNITS)[number]; perPeriod: number }> = {
  year: { unit: 'quarter', perPeriod: 4 },
  month: { unit: 'week', perPeriod: 4 },
  week: { unit: 'day', perPeriod: 5 },
  day: { unit: 'hour', perPeriod: 8 }
};

export const MAX_PERIODS = 10;

export const Time = z.object({
  period: z.object({ unit: z.enum(PERIOD_UNITS), count: z.number().int().min(1).max(MAX_PERIODS) }),
  subPeriod: z.object({ unit: z.enum(SUB_PERIOD_UNITS), perPeriod: z.number().int().min(2).max(12) }).optional(),
  /** Smallest action cost, in sub-periods. */
  costStep: z.union([z.literal(0.5), z.literal(1)]).default(0.5)
}).transform(t => ({ ...t, subPeriod: t.subPeriod ?? SUB_PERIOD_DEFAULTS[t.period.unit] }));

export const Stage = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  conversionRatio: Ratio,
  ideal: z.number().int().min(0)
});

export const MIN_STAGES = 3;
export const MAX_STAGES = 6;

const Stats = z.object({ skill: Score, morale: Score, result: Score });

export const Person = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  title: z.string().min(1),
  pronoun: z.enum(['he', 'she', 'they']),
  homeStage: z.string(),
  start: Stats.extend({ trust: Score }),
  /** Values in every stage, used by swap and assess (docs/SIMULATION.md 4.3). */
  byStage: z.record(z.string(), Stats),
  profile: z.object({ previous: z.string(), tenure: z.string(), experience: z.string(), skills: z.string(), remarks: z.string(), relations: z.string().default('') }),
  hiddenConcern: z.string().optional(),
  portraits: z.record(z.enum(['happy', 'neutral', 'thinking', 'concerned', 'frustrated']), z.string()).optional(),
  voice: z.string().optional()
});

export const Thresholds = z.object({
  high: Score.default(70),
  amber: Score.default(50),
  low: Score.default(30)
});

export const Tiers = z.object({
  silver: Ratio.default(0.4),
  gold: Ratio.default(0.6),
  platinum: Ratio.default(0.8)
}).refine(t => t.silver < t.gold && t.gold < t.platinum, 'Tier thresholds must rise: silver < gold < platinum');

export const StorylineConfig = z.object({
  id: z.string(),
  name: z.string(),
  money: Money,
  time: Time,
  stages: z.array(Stage).min(MIN_STAGES).max(MAX_STAGES),
  members: z.array(Person).min(6).max(12),
  candidates: z.array(Person).default([]),
  thresholds: Thresholds.default({ high: 70, amber: 50, low: 30 }),
  tiers: Tiers.default({ silver: 0.4, gold: 0.6, platinum: 0.8 }),
  /** Funnel buffer from the Model doc, set by calibration. */
  performanceThreshold: z.number().min(-50).max(50),
  calibrated: z.boolean().default(false)
}).superRefine((c, ctx) => {
  const stageKeys = new Set(c.stages.map(s => s.key));
  if (stageKeys.size !== c.stages.length) ctx.addIssue({ code: 'custom', path: ['stages'], message: 'Stage keys must be unique' });
  if (c.money.inputPerSubPeriod.length !== 1 && c.money.inputPerSubPeriod.length !== c.time.period.count)
    ctx.addIssue({ code: 'custom', path: ['money', 'inputPerSubPeriod'], message: `Give one value, or one per period (${c.time.period.count})` });
  const ids = new Set<string>();
  for (const [list, people] of [['members', c.members], ['candidates', c.candidates]] as const) {
    people.forEach((p, i) => {
      if (ids.has(p.id)) ctx.addIssue({ code: 'custom', path: [list, i, 'id'], message: `Duplicate person id ${p.id}` });
      ids.add(p.id);
      if (!stageKeys.has(p.homeStage)) ctx.addIssue({ code: 'custom', path: [list, i, 'homeStage'], message: `Unknown stage ${p.homeStage}` });
      for (const s of stageKeys) if (!p.byStage[s]) ctx.addIssue({ code: 'custom', path: [list, i, 'byStage', s], message: `Missing values for stage ${s}` });
    });
  }
  if (!(c.thresholds.low < c.thresholds.amber && c.thresholds.amber < c.thresholds.high))
    ctx.addIssue({ code: 'custom', path: ['thresholds'], message: 'Thresholds must rise: low < amber < high' });
});

export type StorylineConfig = z.output<typeof StorylineConfig>;
export type StorylineInput = z.input<typeof StorylineConfig>;

/** Parses a storyline, returning readable issues instead of throwing. */
export function parseStoryline(input: unknown): { ok: true; config: StorylineConfig } | { ok: false; issues: string[] } {
  const r = StorylineConfig.safeParse(input);
  if (r.success) return { ok: true, config: r.data };
  return { ok: false, issues: r.error.issues.map(i => `${i.path.join('.') || 'storyline'}: ${i.message}`) };
}

/** Money formatting for a storyline. Negative amounts use the minus sign, per the copy rules. */
export function moneyFormatter(money: z.output<typeof Money>) {
  const base = { style: 'currency' as const, currency: money.currency, currencyDisplay: money.display };
  const full = new Intl.NumberFormat(money.locale, { ...base, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const exact = new Intl.NumberFormat(money.locale, base);
  const compact = new Intl.NumberFormat(money.locale, { ...base, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const fix = (s: string) => s.replace(/-/g, '−');
  return {
    /** HUD and board: whole units, "$41,200", "¥4,120,000", "₹41,20,000". */
    format: (n: number) => fix(full.format(n)),
    /** Report tables: the currency's own decimals. */
    exact: (n: number) => fix(exact.format(n)),
    /** Tight spaces: "$240K", "₹24L". */
    compact: (n: number) => fix(compact.format(n))
  };
}
