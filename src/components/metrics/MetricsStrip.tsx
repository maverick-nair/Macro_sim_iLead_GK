import { useId } from 'react';
import type { MetricKey } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import { KpiTile, type KpiTrend } from '../metric/KpiTile';
import type { PeriodUnit } from '../hud/Hud';

export const SPONSOR_LEVELS = ['low', 'wavering', 'steady', 'confident', 'champion'] as const;
export type SponsorLevel = (typeof SPONSOR_LEVELS)[number];

export interface MetricsKpi {
  metric: MetricKey;
  value: number;
  trend: KpiTrend;
}

export interface TeamPulse {
  upbeat: number;
  steady: number;
  struggling: number;
}

export interface MetricsTarget {
  /** Heading; defaults to "Quarter target". */
  label?: string;
  /** Money earned so far, in the currency's major unit. */
  value: number;
  target: number;
  /** Where the pace marker sits on the bar, 0 to 1. */
  pace: number;
  /** The period the pace marker stands for; names it in the marker's tooltip ("Week 2 pace"). */
  pacePeriod?: { unit: PeriodUnit; n: number };
}

export interface SponsorCause {
  /** Engine text, shown as is. */
  text: string;
  /** Sign sets the arrow: up raised confidence, down lowered it. */
  delta: number;
}

export interface SponsorConfidence {
  level: SponsorLevel;
  causes: SponsorCause[];
  open: boolean;
  onToggle: () => void;
}

export interface MetricsStripProps {
  kpis: MetricsKpi[];
  pulse: TeamPulse;
  target: MetricsTarget;
  sponsor: SponsorConfidence;
}

const tile = 'flex flex-col gap-1.5 rounded-16 border border-line-default bg-surface-card px-3.5 py-2.5 backdrop-blur-12';
const PULSE = [
  { group: 'upbeat', bg: 'bg-metrics-pulse-upbeat' },
  { group: 'steady', bg: 'bg-metrics-pulse-steady' },
  { group: 'struggling', bg: 'bg-metrics-pulse-struggling' }
] as const;
const pct = (n: number) => `${Math.max(0, Math.min(100, n * 100))}%`;

/** How the team is doing, in one row: the four team KPIs, Team Pulse, the money target and sponsor confidence. */
export function MetricsStrip({ kpis, pulse, target, sponsor }: MetricsStripProps) {
  const { t, number } = useI18n();
  const money = useMoney();
  const popId = useId();

  // Empty groups drop out of both the bar and the counts, as in the design.
  const groups = PULSE.map(g => ({ ...g, n: pulse[g.group] })).filter(g => g.n);
  const value = money.format(target.value), goal = money.format(target.target);
  const paceTitle = target.pacePeriod ? t('metrics.target.paceAt', { period: t('time.period', { unit: target.pacePeriod.unit, n: target.pacePeriod.n }) }) : t('metrics.target.pace');
  const filled = SPONSOR_LEVELS.indexOf(sponsor.level) + 1;

  return (
    <section aria-label={t('metrics.strip.aria')} className="grid grid-cols-(--il-metrics-strip-columns) gap-2.5 px-6 pt-0 pb-3.5">
      {kpis.map(k => <KpiTile key={k.metric} {...k} />)}
      <div aria-label={t('metrics.pulse.aria', { upbeat: pulse.upbeat, steady: pulse.steady, struggling: pulse.struggling })} className={tile}>
        <span className="text-12 text-fg-secondary">{t('metrics.pulse.title')}</span>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-5">
          {groups.map(g => <div key={g.group} className={g.bg} style={{ flex: g.n }} />)}
        </div>
        <div className="flex gap-2.5 text-12 text-fg-secondary">
          {groups.map(g => <span key={g.group}><b className="text-fg-primary">{number(g.n)}</b> {t('metrics.pulse.group', { group: g.group })}</span>)}
        </div>
      </div>
      <div aria-label={t('metrics.target.aria', { value, target: goal })} className={tile}>
        <span className="text-12 text-fg-secondary">{target.label ?? t('metrics.target.label')}</span>
        <div className="flex items-baseline gap-1.5"><b className="text-20">{value}</b><span className="text-12 text-fg-secondary">{t('metrics.target.of', { target: goal })}</span></div>
        <div className="relative h-1.5 rounded-3 bg-track">
          <div className="absolute top-0 bottom-0 left-0 rounded-3 bg-meter" style={{ width: pct(target.target ? target.value / target.target : 0) }} />
          <div title={paceTitle} className="absolute -top-0.75 -bottom-0.75 w-0.5 bg-fg-primary" style={{ left: pct(target.pace) }} />
        </div>
      </div>
      <div className="relative">
        <button type="button" onClick={sponsor.onToggle} aria-expanded={sponsor.open} aria-controls={sponsor.open ? popId : undefined}
          className={`${tile} size-full cursor-pointer text-left text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary`}>
          <span className="text-12 text-fg-secondary">{t('metrics.sponsor.title')}</span>
          <b className="text-16">{t('metrics.sponsor.level', { level: sponsor.level })}</b>
          <div className="flex w-full gap-0.75">
            {SPONSOR_LEVELS.map((l, i) => <div key={l} className={`h-1.5 flex-1 rounded-3 ${i < filled ? 'bg-meter' : 'bg-track'}`} />)}
          </div>
        </button>
        {sponsor.open && (
          <div id={popId} className="absolute top-full right-0 z-40 mt-2 flex w-70 flex-col gap-2 rounded-16 border border-line-strong bg-surface-material p-3.5 text-13 shadow-(--il-metrics-popover-shadow)">
            <b>{t('metrics.sponsor.causes')}</b>
            {sponsor.causes.map((c, i) => {
              const dir = c.delta > 0 ? 'up' : c.delta < 0 ? 'down' : 'flat';
              const tone = dir === 'up' ? 'text-status-gain' : dir === 'down' ? 'text-status-decline' : 'text-fg-secondary';
              return <span key={i}><span className={tone}>{t('metrics.sponsor.mark', { dir })}</span> {c.text}</span>;
            })}
          </div>
        )}
      </div>
    </section>
  );
}
