import { useId } from 'react';
import type { MetricKey } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import { KpiTile, type KpiTrend } from '../metric/KpiTile';
import type { PeriodUnit, SubPeriodUnit } from '../hud/Hud';

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
  /**
   * The engine's Team Pulse (the mean of team morale and trust, scoring-and-report.md 6) and its trend
   * since the start of the period. When given, the tile shows the number with its arrow over the mood
   * bar, and the counts move to the tile's name and tooltip. The design frames pass none.
   */
  value?: number;
  trend?: 'up' | 'down' | 'flat';
  /** The period the trend runs over ("since the start of the week"). */
  periodUnit?: PeriodUnit;
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
  /**
   * The meter's value, 0 to 100, and its two lines (Configuration Spec, CEO meter): at `unlockAt` the
   * sponsor offers a reward, below `checkInBelow` the CEO asks for a check in that costs a sub period.
   * When given, the tile reads "Confident, 72" and the popover says what the lines mean. The design frames pass none.
   */
  meter?: { value: number; unlockAt: number; checkInBelow: number; sponsorName: string; subPeriodUnit: SubPeriodUnit };
}

export interface MetricsStripProps {
  kpis: MetricsKpi[];
  pulse: TeamPulse;
  target: MetricsTarget;
  sponsor: SponsorConfidence;
}

const tile = 'flex flex-col gap-1.5 rounded-16 border border-line-default bg-surface-card px-3.5 py-2.5 backdrop-blur-12 short:gap-1 short:py-1.5';
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
  const counts = { upbeat: pulse.upbeat, steady: pulse.steady, struggling: pulse.struggling };
  const pulseDir = pulse.trend ?? 'flat';
  const pulseTone = pulseDir === 'up' ? 'text-status-gain' : pulseDir === 'down' ? 'text-status-decline' : 'text-fg-secondary';
  const moodBar = (
    <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-5">
      {groups.map(g => <div key={g.group} className={g.bg} style={{ flex: g.n }} />)}
    </div>
  );
  const meter = sponsor.meter;

  const pulseTile = pulse.value === undefined ? (
    <div role="group" aria-label={t('metrics.pulse.aria', { upbeat: pulse.upbeat, steady: pulse.steady, struggling: pulse.struggling })} className={tile}>
      <span className="text-12 text-fg-secondary">{t('metrics.pulse.title')}</span>
      {moodBar}
      {/* Counts wrap as a whole ("4 struggling") when the tile is narrow, never mid count. */}
      <div className="flex flex-wrap gap-x-2.5 text-12 text-fg-secondary">
        {groups.map(g => <span key={g.group} className="whitespace-nowrap"><b className="text-fg-primary">{number(g.n)}</b> {t('metrics.pulse.group', { group: g.group })}</span>)}
      </div>
    </div>
  ) : (
    // The engine's pulse: the number and its trend, then the mood bar. The counts are in the name and the tooltip.
    <div role="group" title={t('metrics.pulse.tip', counts)}
      aria-label={t('metrics.pulse.valueAria', { value: number(pulse.value), dir: pulseDir, unit: pulse.periodUnit ?? 'week', ...counts })} className={tile}>
      <span className="text-12 text-fg-secondary">{t('metrics.pulse.title')}</span>
      <div className="flex items-baseline gap-2">
        <b className="text-22 font-700 short:text-18">{number(pulse.value)}</b>
        <span className={`text-12 font-700 ${pulseTone}`}><span aria-hidden="true">{t('metric.trend.glyph', { dir: pulseDir })}</span>{' '}{t('metric.trend.word', { dir: pulseDir })}</span>
      </div>
      {moodBar}
    </div>
  );
  const targetTile = (
    <div role="group" aria-label={t('metrics.target.aria', { value, target: goal })} data-tour="target" className={`${tile} tablet-portrait:col-span-2`}>
      <span className="text-12 text-fg-secondary">{target.label ?? t('metrics.target.label')}</span>
      <div className="flex items-baseline gap-1.5 text-large:flex-wrap"><b className="text-20 short:text-17">{value}</b><span className="text-12 text-fg-secondary">{t('metrics.target.of', { target: goal })}</span></div>
      <div className="relative h-1.5 rounded-3 bg-track">
        <div className="absolute top-0 bottom-0 start-0 rounded-3 bg-meter" style={{ width: pct(target.target ? target.value / target.target : 0) }} />
        <div title={paceTitle} className="absolute -top-0.75 -bottom-0.75 w-0.5 bg-fg-primary" style={{ left: pct(target.pace) }} />
      </div>
    </div>
  );
  const sponsorTile = (cls: string) => (
    <button type="button" onClick={sponsor.onToggle} aria-expanded={sponsor.open} aria-controls={sponsor.open ? popId : undefined}
      className={`${tile} ${cls} cursor-pointer text-start text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary`}>
      <span className="text-12 text-fg-secondary">{t('metrics.sponsor.title')}</span>
      <b className="text-16">{meter ? t('metrics.sponsor.levelValue', { level: sponsor.level, value: number(meter.value) }) : t('metrics.sponsor.level', { level: sponsor.level })}</b>
      <div className="flex w-full gap-0.75">
        {SPONSOR_LEVELS.map((l, i) => <div key={l} className={`h-1.5 flex-1 rounded-3 ${i < filled ? 'bg-meter' : 'bg-track'}`} />)}
      </div>
    </button>
  );
  const causes = (cls: string) => (
    <div id={popId} className={`${cls} flex flex-col gap-2 rounded-16 border border-line-strong bg-surface-material p-3.5 text-13 shadow-(--il-metrics-popover-shadow)`}>
      <b>{t('metrics.sponsor.causes')}</b>
      {meter && sponsor.causes.length === 0 && <span className="text-fg-secondary">{t('metrics.sponsor.none')}</span>}
      {sponsor.causes.map((c, i) => {
        const dir = c.delta > 0 ? 'up' : c.delta < 0 ? 'down' : 'flat';
        const tone = dir === 'up' ? 'text-status-gain' : dir === 'down' ? 'text-status-decline' : 'text-fg-secondary';
        // The arrow is decorative; the direction is read out in words.
        return <span key={i}><span aria-hidden="true" className={tone}>{t('metrics.sponsor.mark', { dir })}</span><span className="sr-only">{t('metrics.sponsor.dir', { dir })}</span> {c.text}</span>;
      })}
      {meter && (
        <>
          <b className="border-t border-line-default pt-2">{t('metrics.sponsor.lines')}</b>
          <span>{t('metrics.sponsor.unlock', { at: number(meter.unlockAt), name: meter.sponsorName })}</span>
          <span>{t('metrics.sponsor.checkIn', { below: number(meter.checkInBelow), unit: meter.subPeriodUnit })}</span>
        </>
      )}
    </div>
  );

  return (
    <section aria-label={t('metrics.strip.aria')} data-tour="kpis" className="grid grid-cols-(--il-metrics-strip-columns) gap-2.5 text-large:grid-cols-(--il-metrics-strip-columns-large) px-6 pt-0 pb-3.5 short:pb-2 tablet-portrait:grid-cols-4 tablet-portrait:pt-4 tablet-portrait:pb-0">
      {kpis.map(k => <KpiTile key={k.metric} {...k} />)}
      {pulseTile}
      {targetTile}
      <div className="relative">
        {sponsorTile('size-full')}
        {sponsor.open && causes('absolute top-full end-0 z-40 mt-2 w-70')}
      </div>
    </section>
  );
}
