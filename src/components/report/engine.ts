import type { EngineView } from '../../engine/contract';
import type { I18n } from '../../i18n';
import { checkInDate, intentTone, multipleDomain, talkRatio } from './display';
import type {
  AnalyticsData, BusinessData, FitRow, IntentCardData, MethodologyData, MomentData, PeriodUnit, PersonData, PlanItemData,
  ReportHeaderData, SkillRowData, StyleExtras, StyleKey, SummaryExtras, TeamSeries
} from './types';
import './messages';

/**
 * The engine's report (`view.report`) shaped into the report components' props. Display mapping only:
 * every level, share, status and sentence comes from the engine; this picks names, formats numbers and
 * words the catalog's chrome around them.
 */

export type ReportView = NonNullable<EngineView['report']>;
type Fmt = Pick<I18n, 't' | 'number' | 'delta' | 'locale'>;
export interface MoneyFormat { format: (n: number) => string; compact: (n: number) => string }

export interface ReportModelOptions {
  /** The participant's name; not engine data. */
  participantName?: string | null;
  /** The report date, for the header and the check in date. */
  date: Date;
  /** The unit of days spent per person ("day"). */
  subPeriodUnit: string;
}

export type SectionModel =
  | { key: 'summary'; narrative: string | null; extras: SummaryExtras }
  | { key: 'style'; periods: number[]; rows: FitRow[]; summary: string; extras: StyleExtras }
  | { key: 'intent'; cards: IntentCardData[] }
  | { key: 'skills'; rows: SkillRowData[]; levels: string[] }
  | { key: 'moments'; moments: MomentData[] }
  | { key: 'people'; people: PersonData[] }
  | { key: 'business'; data: BusinessData }
  | { key: 'analytics'; data: AnalyticsData }
  | { key: 'plan'; items: PlanItemData[]; reflection: string | null; checkIn: string }
  | { key: 'methodology'; data: MethodologyData };

export interface ReportModel {
  header: ReportHeaderData;
  unit: PeriodUnit;
  periods: number;
  team: TeamSeries[];
  /** In the author's order; the team over the run follows the summary, or the header when the summary is off. */
  sections: SectionModel[];
}


export function monthYear(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}
export function longDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Names listed with commas and a final "and". */
export function listNames(i18n: Pick<I18n, 't'>, names: string[]): string {
  if (names.length < 2) return names.join('');
  return names.slice(0, -1).join(i18n.t('report.listSeparator')) + i18n.t('report.listAnd') + names[names.length - 1];
}

/** The small multiples: cumulative revenue against target pace, then the four team metrics over the run. */
export function teamSeries(i18n: Fmt, money: MoneyFormat, r: ReportView): TeamSeries[] {
  const { t, number } = i18n;
  const revenue = r.business.revenue;
  const rev: TeamSeries[] = revenue.length ? [(() => {
    const values = revenue.map(p => p.value), target = revenue.map(p => p.pace);
    const label = t('report.team.metric', { metric: 'revenue' });
    const end = money.compact(values[values.length - 1]);
    return {
      key: 'revenue', label, end, values, target, domain: multipleDomain(values, target),
      note: t('report.team.revenueNote'),
      summary: t('report.team.aria', { label, start: money.compact(values[0]), end }),
      cells: values.map(money.format), targetCells: target.map(money.format)
    };
  })()] : [];
  return rev.concat(r.results.kpis.filter(k => k.series.length).map(k => {
    const label = t('report.team.metric', { metric: k.metric });
    const end = k.series[k.series.length - 1];
    return {
      key: k.metric, label, end: number(end), values: k.series, target: null, domain: multipleDomain(k.series, null),
      note: t('report.team.change', { dir: end > k.start ? 'up' : end < k.start ? 'down' : 'same', start: number(k.start) }),
      summary: t('report.team.aria', { label, start: number(k.start), end: number(end) }),
      cells: k.series.map(number), targetCells: null
    };
  }));
}

export function buildReportModel(i18n: Fmt, money: MoneyFormat, r: ReportView, o: ReportModelOptions): ReportModel {
  const { t, number, delta, locale } = i18n;
  const unit = r.periodUnit;
  // Style names come from the storyline's lens (D70).
  const styleName = (s: StyleKey) => r.lens.styles.find(x => x.key === s)?.name ?? s;
  const skillName = (key: string) => r.skills.find(s => s.key === key)?.name ?? key;
  const periods = Array.from({ length: r.periods }, (_, i) => i + 1);
  const short = (n: number) => t('report.team.period', { unit, n });

  const header: ReportHeaderData = {
    name: o.participantName?.trim() || t('report.unnamed'),
    // The storyline's name may already carry the organisation ("Sales Elevator, Innov8 Elevators").
    line: [r.storyline.name, r.storyline.organisation && !r.storyline.name.includes(r.storyline.organisation) ? r.storyline.organisation : null, monthYear(o.date, locale)].filter(Boolean).join(t('report.separator')),
    tier: r.score.tier.name,
    score: number(r.score.total)
  };

  const section = (key: ReportView['sections'][number]): SectionModel => {
    switch (key) {
      case 'summary':
        return { key, narrative: r.summary.narrative, extras: { level: r.summary.level?.name ?? null, strengths: r.summary.strengths.map(skillName), priorities: r.summary.priorities.map(skillName), business: r.summary.business } };
      case 'style':
        return {
          key, periods,
          rows: r.style.weeks.map(w => ({
            id: w.memberId, name: w.name, fullName: w.name, left: w.left,
            cells: periods.map((_, i) => {
              const c = w.cells[i];
              return c ? { style: c.chosen, fit: Math.min(2, Math.max(0, c.fit)) as 0 | 1 | 2 } : null;
            })
          })),
          summary: t('report.fit.summary', { matched: r.style.matched, total: r.style.weeklyTotal }),
          extras: { shares: r.style.shares, total: r.style.total, dominant: r.style.dominant, capability: r.style.capability, grid: r.style.grid, fit: r.style.fit, narrative: r.style.narrative,
            styles: r.lens.styles.map(s => ({ key: s.key, letter: s.letter, name: s.name })), needs: r.lens.needs }
        };
      case 'intent':
        return {
          key,
          cards: r.intent.map(x => ({
            key: x.memberId, name: x.name, said: x.note?.text ?? null,
            did: t('report.intent.didText', { intent: listNames(i18n, x.intent.map(styleName)), unit, shown: x.shown.length ? listNames(i18n, x.shown.map(styleName)) : 'none' }),
            verdict: t('report.intent.verdict', { status: x.status }), tone: intentTone(x.status),
            quote: x.quote, cost: x.trustCost < 0 ? t('report.intent.cost', { delta: delta(x.trustCost) }) : null
          }))
        };
      case 'skills':
        return {
          key, levels: r.scale.map(s => s.name),
          rows: r.skills.map(s => ({ key: s.key, name: s.name, level: s.level, quote: s.quotes[0] ?? null, more: { anchor: s.anchor, observations: s.observations, capped: s.capped, quotes: s.quotes.slice(1) } }))
        };
      case 'moments':
        return {
          key,
          moments: r.moments.map((m, i) => ({
            key: `${m.id}-${i}`, kind: m.kind, when: t('time.period', { unit, n: m.period }), title: m.title, situation: m.situation,
            behaviour: m.behaviour, quote: m.quote, impact: m.impact, intent: m.intent ? styleName(m.intent) : null
          }))
        };
      case 'people':
        return {
          key,
          people: r.people.map(p => ({
            id: p.memberId, name: p.name, left: p.left,
            points: [{ label: t('report.table.start'), ...p.start }, ...p.series.map(s => ({ label: short(s.period), morale: s.morale, trust: s.trust, result: s.result }))],
            actions: p.actions, days: t('time.amount', { unit: o.subPeriodUnit, n: p.days }), resultChange: p.resultChange
          }))
        };
      case 'business': {
        const b = r.business;
        return {
          key,
          data: {
            revenue: b.revenue.map(p => ({ label: short(p.period), value: p.value, pace: p.pace })),
            money: money.compact,
            funnel: b.funnel.map(f => ({ key: f.stage, name: f.name, value: f.cumulative, ideal: f.cumulativeIdeal, bottleneck: f.stage === b.bottleneck?.stage })),
            bottleneck: b.bottleneck ? { name: b.bottleneck.name, periods: b.bottleneck.periods, why: b.bottleneck.why } : null,
            conversions: b.conversions,
            line: r.summary.business
          }
        };
      }
      case 'analytics':
        return { key, data: { ...r.analytics, talkRatio: talkRatio(r.analytics.talkRatio) } };
      case 'plan': {
        const answer = r.reflection?.answers.find(a => a.trim())?.trim() ?? null;
        return {
          key,
          items: r.plan.map(p => ({ key: p.skill, skill: p.name, text: p.practice, onTheJob: p.onTheJob, enoughEvidence: p.enoughEvidence })),
          reflection: answer,
          checkIn: t('report.plan.checkIn', { date: longDate(checkInDate(o.date, r.checkInDays), locale) })
        };
      }
      case 'methodology':
        return { key, data: r.methodology };
    }
  };

  return { header, unit, periods: r.periods, team: teamSeries(i18n, money, r), sections: [...new Set(r.sections)].map(section) };
}
