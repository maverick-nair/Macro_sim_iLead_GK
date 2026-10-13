import type { HistoryEntry, ReportView } from '../../engine/reportContract';
import type { I18n } from '../../i18n';
import { checkInDate, intentTone, multipleDomain, talkRatio, verdictTone } from './display';
import type {
  AboutData, ActionRowData, AdaptabilityData, AnalyticsData, BusinessData, BusinessVariableData, ConsistencyData, DecisionData, DistributionData, FitRow, IntentCardData, MethodologyData, StakeholderData,
  MomentData, ObjectivesData, PeriodUnit, PersonData, PlanExtras, PlanItemData, ProgressData, Purpose, ReportHeaderData, SkillRowData, StyleExtras,
  StyleKey, StylesData, SummaryExtras, TeamSeries, ThoughtData, VerdictData
} from './types';
import './messages';

/**
 * The engine's report (`view.report`, parsed with `parseReport`) shaped into the report components' props.
 * Display mapping only: every level, share, status, verdict and sentence comes from the engine; this
 * picks names, formats numbers and words the catalog's chrome around them.
 */

export type { ReportView };
type Fmt = Pick<I18n, 't' | 'number' | 'delta' | 'formatLocale'>;
export interface MoneyFormat { format: (n: number) => string; compact: (n: number) => string }

export interface ReportModelOptions {
  /** The participant's name; not engine data. */
  participantName?: string | null;
  /** The report date, for the header and the check in dates. */
  date: Date;
  /** The unit of days spent per person ("day"). */
  subPeriodUnit: string;
  /** Earlier attempts (`getHistory`); the progress section shows only when there are some. */
  history?: HistoryEntry[] | null;
}

export type SectionModel =
  | { key: 'about'; data: AboutData }
  | { key: 'summary'; narrative: string | null; extras: SummaryExtras }
  | { key: 'skills'; rows: SkillRowData[]; levels: string[] }
  | { key: 'objectives'; data: ObjectivesData }
  | { key: 'adaptability'; data: AdaptabilityData }
  | { key: 'styles'; data: StylesData }
  | { key: 'style'; periods: number[]; rows: FitRow[]; summary: string; extras: StyleExtras }
  | { key: 'consistency'; data: ConsistencyData }
  | { key: 'intent'; cards: IntentCardData[] }
  | { key: 'actions'; rows: ActionRowData[] }
  | { key: 'distribution'; data: DistributionData }
  | { key: 'moments'; moments: MomentData[] }
  | { key: 'decisions'; decisions: DecisionData[]; variables: BusinessVariableData[] }
  | { key: 'people'; people: PersonData[] }
  | { key: 'business'; data: BusinessData }
  | { key: 'analytics'; data: AnalyticsData }
  | { key: 'thought'; data: ThoughtData }
  | { key: 'takeaways'; lines: string[] }
  | { key: 'plan'; items: PlanItemData[]; reflection: string | null; checkIn: string; extras: PlanExtras }
  | { key: 'progress'; data: ProgressData }
  | { key: 'methodology'; data: MethodologyData }
  | { key: 'stakeholders'; stakeholders: StakeholderData[] };

export interface ReportModel {
  purpose: Purpose;
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
      cells: k.series.map(n => number(n)), targetCells: null
    };
  }));
}

/** A verdict's evidence, review status and records, worded for the report. */
function verdictData(i18n: Fmt, v: { key: string | null; label: string; recordIds: string[]; quotes: Array<{ text: string; when: string }>; review: 'assessor' | 'mixed' | 'ai'; reviewed: number; total: number }, bar: string): VerdictData {
  const { t } = i18n;
  return {
    key: v.key, label: v.label, bar: t('report.verdict.bar', { bar }),
    evidence: t('report.verdict.evidence', { n: v.total }),
    review: t('report.verdict.review', { review: v.review, reviewed: v.reviewed, total: v.total }),
    records: t('report.verdict.records', { ids: v.recordIds.join(t('report.listSeparator')) }),
    quotes: v.quotes, tone: verdictTone(v.key)
  };
}

export function buildReportModel(i18n: Fmt, money: MoneyFormat, r: ReportView, o: ReportModelOptions): ReportModel {
  const { t, number, delta, formatLocale: locale } = i18n;
  const unit = r.periodUnit;
  const purpose = r.purpose;
  // Style names come from the storyline's lens (D70).
  const styleName = (s: StyleKey) => r.lens.styles.find(x => x.key === s)?.name ?? s;
  const skillName = (key: string) => r.skills.find(s => s.key === key)?.name ?? key;
  const actionName = (key: string) => r.actionSummary.find(a => a.key === key)?.name ?? key;
  const needLabel = (key: string) => r.lens.needs.find(n => n.key === key)?.label ?? key;
  const periods = Array.from({ length: r.periods }, (_, i) => i + 1);
  const short = (n: number) => t('report.team.period', { unit, n });
  const pct = (n: number) => Math.round(n);

  const header: ReportHeaderData = {
    name: o.participantName?.trim() || t('report.unnamed', { purpose }),
    // The storyline's name may already carry the organisation ("Sales Elevator, Innov8 Elevators").
    line: [r.storyline.name, r.storyline.organisation && !r.storyline.name.includes(r.storyline.organisation) ? r.storyline.organisation : null, monthYear(o.date, locale)].filter(Boolean).join(t('report.separator')),
    tier: r.score.tier.name,
    score: number(r.score.total)
  };

  const section = (key: ReportView['sections'][number]): SectionModel | null => {
    switch (key) {
      case 'about':
        return { key, data: r.about };
      case 'summary':
        return { key, narrative: r.summary.narrative, extras: {
          level: r.summary.level?.name ?? null, strengths: r.summary.strengths.map(skillName), priorities: r.summary.priorities.map(skillName), business: r.summary.business,
          verdict: r.verdict ? verdictData(i18n, r.verdict.overall, r.verdict.overall.bar) : null,
          headline: r.summary.headline, lines: r.summary.lines, drivers: r.summary.drivers
        } };
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
      case 'skills': {
        const verdicts = new Map((r.verdict?.skills ?? []).map(v => [v.key, v]));
        return {
          key, levels: r.scale.map(s => s.name),
          rows: r.skills.map(s => {
            const v = verdicts.get(s.key);
            return {
              key: s.key, name: s.name, reportOnly: s.reportOnly, level: s.level, quote: s.quotes[0] ?? null,
              more: {
                anchor: s.anchor, observations: s.observations, capped: s.capped, quotes: s.quotes.slice(1),
                outOf10: s.outOf10 === null ? null : t('report.skills.outOf10', { score: number(s.outOf10) }),
                description: s.description, narrative: s.narrative, reconciliation: s.reconciliation,
                verdict: v?.label ? { label: v.label, tone: verdictTone(v.verdict), review: t('report.verdict.review', { review: v.review, reviewed: v.reviewed, total: v.total }) } : null
              }
            };
          })
        };
      }
      case 'objectives': {
        const o3 = r.run.objectives;
        return { key, data: {
          revenue: o3.revenue, target: o3.target, money: money.compact, share: t('report.percent', { pct: pct(o3.share) }), conversions: o3.conversions,
          team: (['skill', 'morale', 'result'] as const).map(k => ({ key: k, label: t('report.team.metric', { metric: k }), start: o3.team[k].start, end: o3.team[k].end })),
          narrative: r.objectives.narrative
        } };
      }
      case 'adaptability':
        return { key, data: { pct: pct(r.run.styles.adaptability), narrative: r.adaptability.narrative } };
      case 'styles':
        return { key, data: {
          styles: r.lens.styles.map(s => {
            const st = r.run.styles.perStyle.find(x => x.key === s.key);
            return { key: s.key, letter: s.letter, name: s.name, count: st?.count ?? 0, proportion: pct(st?.proportion ?? 0), accuracy: st?.accuracy == null ? null : pct(st.accuracy),
              narrative: r.styleSummary.perStyle.find(x => x.key === s.key)?.narrative ?? [] };
          }),
          needs: r.lens.needs, grid: r.run.styles.grid, fit: r.style.fit, preferred: r.styleSummary.preferred
        } };
      case 'consistency': {
        const c = r.run.consistency;
        return { key, data: {
          actions: c.actions.map(actionName),
          deviations: (['neededUsed', 'intendedUsed', 'neededIntended'] as const).map(k => ({ key: k, value: c.deviations[k] === null ? null : pct(c.deviations[k]!), narrative: r.consistency.narrative[k] })),
          members: c.members.map(m => ({
            id: m.memberId, name: r.people.find(p => p.memberId === m.memberId)?.name ?? m.memberId,
            needed: m.needed && m.desired ? t('report.consistency.needed', { style: styleName(m.desired), need: needLabel(m.needed) }) : null,
            intended: m.intended ? styleName(m.intended) : null, used: m.used ? styleName(m.used) : null
          }))
        } };
      }
      case 'actions':
        return { key, rows: r.run.actions.map(a => {
          const s = r.actionSummary.find(x => x.key === a.key);
          return { key: a.key, name: s?.name ?? a.key, description: s?.description ?? null, narrative: s?.narrative ?? '', frequency: a.frequency, impact: a.impact };
        }) };
      case 'distribution': {
        const d = r.run.distribution;
        return { key, data: {
          actions: d.actions.map(k => ({ key: k, name: actionName(k) })),
          members: d.members.map(m => ({ id: m.memberId, name: r.people.find(p => p.memberId === m.memberId)?.name ?? m.name, left: m.left, cells: m.cells.map(c => ({ count: c.count, impact: c.impact })) })),
          totals: d.totals
        } };
      }
      case 'moments':
        return {
          key,
          moments: r.moments.map((m, i) => ({
            key: `${m.id}-${i}`, kind: m.kind, when: t('time.period', { unit, n: m.period }), title: m.title, situation: m.situation,
            behaviour: m.behaviour, quote: m.quote, impact: m.impact, intent: m.intent ? styleName(m.intent) : null
          }))
        };
      case 'decisions': {
        if (!r.decisions.length && !r.businessVariables.length) return null;
        const value = (format: 'money' | 'percent' | 'points', v: number, signed = false) => {
          const n = format === 'money' ? money.compact(Math.abs(v)) : number(Math.abs(Math.round(v)));
          const sign = signed ? (v > 0 ? '+' : v < 0 ? '−' : '') : v < 0 ? '−' : '';
          return format === 'percent' ? `${sign}${n}%` : `${sign}${n}`;
        };
        return {
          key,
          variables: r.businessVariables.map(v => ({
            key: v.key, name: v.name, start: value(v.format, v.start), end: value(v.format, v.end),
            direction: v.end > v.start ? 'up' as const : v.end < v.start ? 'down' as const : 'flat' as const,
            better: v.end === v.start ? null : (v.end > v.start) === v.higherIsBetter
          })),
          decisions: r.decisions.map(d => ({
            key: d.id, when: t('time.period', { unit, n: d.period }), title: d.title, option: d.option, by: d.by, outcome: d.outcome,
            changes: [
              ...(d.impact ? [d.impact] : []),
              ...d.variables.map(x => t('report.decisions.variable', { name: x.name, value: value(x.format, x.delta, true) })),
              ...(d.revenue ? [t('report.decisions.revenue', { value: `${d.revenue > 0 ? '+' : '−'}${money.compact(Math.abs(d.revenue))}` })] : []),
              ...(d.sponsor ? [t('report.decisions.sponsor', { delta: d.sponsor })] : [])
            ],
            led: d.triggered.map(x => t('report.decisions.led', { title: x.title, when: t('time.period', { unit, n: x.period }) })),
            read: d.read.map(x => t('report.decisions.read', { skill: x.skill, band: x.band }))
          }))
        };
      }
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
      case 'thought':
        return r.thought.length ? { key, data: { items: r.thought } } : null;
      case 'takeaways':
        return r.takeaways.length ? { key, lines: r.takeaways } : null;
      case 'plan': {
        const answer = r.reflection?.answers.find(a => a.trim())?.trim() ?? null;
        const assessment = purpose === 'assessment';
        return {
          key,
          items: assessment ? [] : r.plan.map(p => ({ key: p.skill, skill: p.name, text: p.practice, onTheJob: p.onTheJob, enoughEvidence: p.enoughEvidence })),
          reflection: assessment ? null : answer,
          checkIn: assessment ? '' : t('report.plan.checkIn', { date: longDate(checkInDate(o.date, r.checkInDays), locale) }),
          extras: assessment
            ? { needs: r.needs.map(n => ({ key: n.key, name: n.name, text: t('report.plan.needLevel', { rated: String(n.level !== null), level: n.level ?? '', bar: n.bar }), anchor: n.anchor ? t('report.plan.needAnchor', { anchor: n.anchor }) : null })) }
            : { path: r.path, checkIns: r.checkIns.map(d => longDate(checkInDate(o.date, d), locale)) }
        };
      }
      case 'progress': {
        const history = (o.history ?? []).filter(h => h.summary.storyline.id === r.run.storyline.id).sort((a, b) => a.attempt - b.attempt);
        if (!history.length) return null;
        const keys = r.skills.filter(s => !s.reportOnly).map(s => ({ key: s.key, name: s.name }));
        const headline = r.verdict ? r.verdict.overall.label : r.summary.level?.name ?? t('report.summary.noLevel');
        const row = (key: string, label: string, current: boolean, head: string, s: ReportView['run']) => ({
          key, label, current, headline: head, score: s.score.total, adaptability: pct(s.styles.adaptability), target: pct(s.objectives.share),
          skills: keys.map(k => s.skills.find(x => x.key === k.key)?.score ?? null)
        });
        return { key, data: {
          skills: keys,
          attempts: [
            ...history.map(h => row(`a${h.attempt}`, t('report.progress.attempt', { current: 'false', n: h.attempt }), false, h.headline, h.summary)),
            row('current', t('report.progress.attempt', { current: 'true', n: history.length + 1 }), true, headline, r.run)
          ]
        } };
      }
      case 'methodology':
        return { key, data: r.methodology };
      case 'stakeholders': {
        // "Stakeholders" (D164): only when the storyline has them.
        if (!r.stakeholders.length) return null;
        const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${number(Math.abs(n))}`;
        const when = (n: number) => t('time.period', { unit, n });
        const dir = (a: number, b: number) => (b > a ? 'up' as const : b < a ? 'down' as const : 'flat' as const);
        return {
          key,
          stakeholders: r.stakeholders.map(s => ({
            key: s.key, name: s.name, role: t('report.stakeholders.role', { role: s.role, kind: s.kind }),
            relationship: t('report.stakeholders.relationship', { from: s.levelStart, to: s.levelEnd }),
            measures: (['trust', 'satisfaction'] as const).map(m => ({ key: m, name: t('report.stakeholders.measure', { measure: m }), start: s.start[m], end: s.end[m], direction: dir(s.start[m], s.end[m]) })),
            interactions: s.interactions.map(x => ({
              key: x.id, when: when(x.period), title: x.title, how: x.option ?? t('report.stakeholders.how', { type: x.type, band: x.band ?? 'none' }), outcome: x.outcome,
              changes: [
                t('report.stakeholders.relation', { trust: signed(x.trust), satisfaction: signed(x.satisfaction) }),
                ...(x.answered ? [t('report.stakeholders.answered')] : []),
                ...x.variables.map(v => t('report.decisions.variable', { name: v.name, value: signed(v.delta) })),
                ...(x.revenue ? [t('report.decisions.revenue', { value: `${x.revenue > 0 ? '+' : '−'}${money.compact(Math.abs(x.revenue))}` })] : []),
                ...(x.sponsor ? [t('report.decisions.sponsor', { delta: x.sponsor })] : []),
                ...x.read.map(y => t('report.decisions.read', { skill: y.skill, band: y.band }))
              ]
            })),
            moves: s.moves.map(m => t('report.stakeholders.move', { when: when(m.period), cause: m.cause, trust: signed(m.trust), satisfaction: signed(m.satisfaction) }))
          }))
        };
      }
    }
  };

  return {
    purpose, header, unit, periods: r.periods, team: teamSeries(i18n, money, r),
    sections: [...new Set(r.sections)].map(section).filter((s): s is SectionModel => s !== null)
  };
}
