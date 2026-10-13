import { useId, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import type { PeriodUnit, SubPeriodUnit } from '../action/days';
import type { BusinessItem } from '../business/BusinessBar';
import { ScoreDisclosure } from '../hud/ScoreDisclosure';
import { MetricTrack } from '../metric/MetricBar';
import { STAR_POINTS } from '../gamification/StarMeter';
import { dirOf, type BandModel, type Dir } from './band';

export interface StatusBandProps {
  model: BandModel;
  periodUnit: PeriodUnit;
  /** What a check in costs is counted in it. */
  subPeriodUnit: SubPeriodUnit;
  /** "8 week target": what the money is, in the storyline's run length. */
  targetLabel: string;
  /** The storyline's shown business variables (D136): client trust, late pipeline, whatever it authors. */
  business: BusinessItem[];
  /** The sponsor's first name, and what last moved their confidence (engine text). */
  sponsorName: string;
  sponsorCauses: Array<{ text: string; delta: number }>;
  /** The Leadership Score and its full breakdown (ScoreBreakdown). */
  score: { total: number };
  breakdown: ReactNode;
  scoreOpen?: boolean;
  onScoreOpenChange?: (open: boolean) => void;
  /** The rank with a way to the leaderboard, when the leaderboard is on (loaded on demand). */
  rank?: ReactNode;
  /** Results and stages (D96). Left out where the panels are not offered (the demo). */
  onOverview?: () => void;
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const EYEBROW = 'm-0 text-12 font-600 uppercase tracking-(--il-desk-band-eyebrow-tracking) text-fg-secondary';
const GROUP = 'flex min-w-0 flex-col gap-1.5 px-4 py-2.5 short:gap-1 short:py-2';
const tone = (d: Dir) => (d === 'up' ? 'text-status-gain' : d === 'down' ? 'text-status-decline' : 'text-fg-secondary');
const pct = (n: number) => `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
/** A text button that reads as part of the band: underlined on hover, the focus ring on the keyboard. */
const LINK = `inline-flex min-h-6 cursor-pointer items-center gap-1 rounded-4 border-0 bg-transparent p-0 text-13 font-600 text-fg-primary underline decoration-line-control underline-offset-3 hover:decoration-fg-primary ${FOCUS}`;

/**
 * A disclosure that opens a small popover under its button: what a business variable means and what moved
 * it, or what moved the sponsor's confidence. Escape or focus leaving closes it.
 */
function Pop({ label, children, content, className, buttonClassName }: { label: string; children: ReactNode; content: ReactNode; className?: string; buttonClassName: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape inside the open popover; the button is the control
    <div ref={wrap} className={`relative ${className ?? ''}`} onBlur={e => { if (!wrap.current?.contains(e.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); button.current?.focus(); } }}>
      <button ref={button} type="button" aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(o => !o)} className={buttonClassName}>{children}</button>
      {open && (
        <div id={id} className="absolute end-0 top-full z-40 mt-2 flex w-72 flex-col gap-2 rounded-6 border border-line-strong bg-surface-material p-3.5 text-13 whitespace-normal shadow-(--il-metrics-popover-shadow)">
          {content}
        </div>
      )}
    </div>
  );
}

/** "↑3" on screen, "up 3 this week" for screen readers. */
function Delta({ delta, unit, className = '' }: { delta: number; unit: PeriodUnit; className?: string }) {
  const { t, number } = useI18n();
  const dir = dirOf(delta);
  const n = number(Math.abs(delta));
  return (
    <span className={`text-12 font-600 tabular-nums whitespace-nowrap ${tone(dir)} ${className}`}>
      <span aria-hidden="true">{t('desk.delta', { dir, n })}</span>
      <span className="sr-only">{t('desk.deltaSr', { dir, n, unit })}</span>
    </span>
  );
}

const Star = ({ on }: { on: boolean }) => (
  <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
    <polygon points={STAR_POINTS} fill={on ? 'var(--il-color-celebration-star)' : 'transparent'} stroke={on ? 'var(--il-color-celebration-star)' : 'var(--il-color-line-control)'} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/**
 * The desk's status band under the HUD (D211, the approved canvas): Team health (the four team numbers and
 * how each moved this period), Business (the money against its target with the pace marker and how far
 * ahead or behind it, the storyline's business variables, Results and stages) and Your progress (the
 * Leadership Score with its tier and the points to the next, the last period's stars, the rank when the
 * leaderboard is on, and the sponsor's confidence against the reward and check in lines). Every number is
 * the engine's; every arrow has its words for screen readers, and nothing relies on colour alone.
 */
export function StatusBand(p: StatusBandProps) {
  const { t, number } = useI18n();
  const money = useMoney();
  const ids = { team: useId(), business: useId(), progress: useId() };
  const { model: m, periodUnit: unit } = p;
  const mo = m.money;
  const gapText = money.compact(Math.abs(mo.gap));
  const sp = m.sponsor;
  const spDir = sp.delta === null ? null : dirOf(sp.delta);
  const lines = { at: number(sp.unlockAt), below: number(sp.checkInBelow) };

  return (
    <section aria-label={t('desk.band.aria')} data-status-band=""
      className="relative z-30 mx-6 mb-3 grid flex-none grid-cols-(--il-desk-band-columns) rounded-6 border border-line-default bg-surface-card short:mb-2 text-large:grid-cols-1">
      {/* Team health */}
      <div role="group" aria-labelledby={ids.team} data-tour="kpis" className={`${GROUP} border-e border-line-default text-large:border-e-0 text-large:border-b`}>
        <h2 id={ids.team} className={EYEBROW}>{t('desk.team.title')}</h2>
        <dl className="m-0 grid grid-cols-4 gap-3 text-large:grid-cols-2">
          {m.kpis.map(k => (
            <div key={k.metric} className="flex min-w-0 flex-col gap-1">
              <dt className="truncate text-12 text-fg-secondary text-large:whitespace-normal">{t('metric.name', { metric: k.metric })}</dt>
              <dd className="m-0 flex flex-col gap-1">
                <span className="flex items-baseline gap-1.5">
                  <b className="text-22 leading-none font-600 tabular-nums short:text-20">{number(k.value)}</b>
                  <Delta delta={k.delta} unit={unit} />
                </span>
                <MetricTrack value={k.value} />
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Business */}
      <div role="group" aria-labelledby={ids.business} data-tour="business" className={`${GROUP} border-e border-line-default text-large:border-e-0 text-large:border-b`}>
        <h2 id={ids.business} className={EYEBROW}>{t('desk.business.title')}</h2>
        <div data-tour="target" className="flex flex-col gap-1.5">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-13">
            <span className="min-w-0"><span className="text-fg-secondary">{p.targetLabel}</span>{' '}<b className="text-15 tabular-nums">{money.format(mo.value)}</b>{' '}<span className="text-fg-secondary">{t('metrics.target.of', { target: money.format(mo.target) })}</span></span>
            <b data-pace={mo.state} className={`text-13 font-600 whitespace-nowrap ${mo.state === 'behind' ? 'text-status-decline' : mo.state === 'ahead' ? 'text-status-gain' : 'text-fg-secondary'}`}>
              {t('desk.money.pace', { state: mo.state, amount: gapText })}
            </b>
          </span>
          <span role="img" aria-label={t('desk.money.barAria', { label: p.targetLabel, share: Math.round(mo.share * 100), pace: Math.round(mo.pace * 100) })} className="relative block h-2 rounded-3 bg-track">
            <span className="absolute inset-y-0 start-0 rounded-3 bg-meter" style={{ width: pct(mo.share) }} />
            <span className="absolute -top-1 -bottom-1 w-0.75 rounded-2 bg-fg-primary" style={{ insetInlineStart: pct(mo.pace) }} />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {p.business.map(v => (
            <Pop key={v.key} label={t('desk.variable.aria', { name: v.name, value: v.value, dir: v.dir, unit })}
              buttonClassName={`inline-flex min-h-6 cursor-pointer items-center gap-1 rounded-4 border-0 bg-transparent p-0 text-13 text-fg-secondary ${FOCUS}`}
              content={<>
                {v.about && <span>{v.about}</span>}
                <b>{t('board.business.causes')}</b>
                {v.causes.length === 0 && <span className="text-fg-secondary">{t('board.business.noCauses')}</span>}
                {v.causes.map((c, i) => <span key={i}><b className={c.dir === 'up' ? 'text-status-gain' : 'text-status-decline'}>{c.change}</b> {c.text}</span>)}
              </>}>
              {v.name} <b className="text-fg-primary tabular-nums">{v.value}</b>
              {v.dir !== 'flat' && <span aria-hidden="true" className={`text-12 font-600 ${v.better === null ? 'text-fg-secondary' : v.better ? 'text-status-gain' : 'text-status-decline'}`}>{v.dir === 'up' ? '↑' : '↓'}</span>}
            </Pop>
          ))}
          {p.onOverview && <button type="button" onClick={p.onOverview} data-tour="overview" className={LINK}>{t('team.overview')}</button>}
        </div>
      </div>

      {/* Your progress */}
      <div role="group" aria-labelledby={ids.progress} data-tour="progress" className={GROUP}>
        <h2 id={ids.progress} className={EYEBROW}>{t('desk.progress.title')}</h2>
        <div className="grid grid-cols-(--il-desk-band-progress-columns) items-start gap-3 text-large:grid-cols-1">
          <div className="flex min-w-0 flex-col gap-1">
            <ScoreDisclosure label={t('desk.score.aria', { total: number(p.score.total), tier: m.tier?.name ?? 'none' })} rich open={p.scoreOpen} onOpenChange={p.onScoreOpenChange} content={p.breakdown}
              popoverClassName="top-full start-0 mt-2" className="self-start"
              buttonClassName={`inline-flex min-h-6 cursor-pointer items-baseline gap-1 rounded-4 border-0 bg-transparent p-0 text-13 whitespace-nowrap text-fg-primary underline decoration-line-control underline-offset-3 hover:decoration-fg-primary ${FOCUS}`}>
              <span>{t('desk.score.label')}</span><b className="text-15 tabular-nums">{number(p.score.total)}</b>{m.tier && <span>· {m.tier.name}</span>}
            </ScoreDisclosure>
            {m.tier && <>
              <span aria-hidden="true" className="block h-1.5 rounded-3 bg-track"><span className="block h-full rounded-3 bg-meter" style={{ width: pct(m.tier.progress) }} /></span>
              <span className="text-12 text-fg-secondary">{m.tier.next ? t('desk.tier.next', { n: number(m.tier.next.toGo), tier: m.tier.next.name }) : t('desk.tier.top')}</span>
            </>}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-13 whitespace-nowrap">{t('desk.stars.title', { has: m.stars ? 'yes' : 'no', unit })}</span>
            {m.stars
              ? <span role="img" aria-label={t('desk.stars.aria', { earned: m.stars.earned, total: 3, period: t('time.period', { unit, n: m.stars.period }) })} className="flex gap-0.5">{[0, 1, 2].map(i => <Star key={i} on={i < m.stars!.earned} />)}</span>
              : <span className="text-12 text-fg-secondary">{t('desk.stars.none', { unit })}</span>}
            {p.rank}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Pop label={t('desk.sponsor.aria', { name: p.sponsorName, value: number(sp.value), change: sp.delta === null ? 'none' : t('desk.deltaSr', { dir: spDir, n: number(Math.abs(sp.delta)), unit }) })}
              className="self-start"
              buttonClassName={`inline-flex min-h-6 cursor-pointer items-baseline gap-1 rounded-4 border-0 bg-transparent p-0 text-13 whitespace-nowrap text-fg-primary underline decoration-line-control underline-offset-3 hover:decoration-fg-primary ${FOCUS}`}
              content={<>
                <b>{t('metrics.sponsor.causes')}</b>
                {p.sponsorCauses.length === 0 && <span className="text-fg-secondary">{t('metrics.sponsor.none')}</span>}
                {p.sponsorCauses.map((c, i) => {
                  const d = dirOf(c.delta);
                  return <span key={i}><span aria-hidden="true" className={tone(d)}>{t('metrics.sponsor.mark', { dir: d })}</span><span className="sr-only">{t('metrics.sponsor.dir', { dir: d })}</span> {c.text}</span>;
                })}
                <b className="border-t border-line-default pt-2">{t('metrics.sponsor.lines')}</b>
                <span>{t('metrics.sponsor.unlock', { at: lines.at, name: p.sponsorName })}</span>
                <span>{t('metrics.sponsor.checkIn', { below: lines.below, unit: p.subPeriodUnit })}</span>
              </>}>
              <span>{p.sponsorName}</span><b className="text-15 tabular-nums">{number(sp.value)}</b>
              {sp.delta !== null && <span aria-hidden="true" className={`text-12 font-600 ${tone(spDir!)}`}>{t('desk.delta', { dir: spDir, n: number(Math.abs(sp.delta)) })}</span>}
            </Pop>
            <span role="img" aria-label={t('desk.sponsor.meterAria', { name: p.sponsorName, value: number(sp.value), ...lines })} className="relative block h-1.5 rounded-3 bg-track">
              <span className="absolute inset-y-0 start-0 rounded-3 bg-meter" style={{ width: pct(sp.value / 100) }} />
              {/* The check in line hangs below the meter and the reward line stands above it: told apart by place, not colour. */}
              <span className="absolute top-0 -bottom-1.5 w-0.5 bg-status-decline" style={{ insetInlineStart: pct(sp.checkInBelow / 100) }} />
              <span className="absolute -top-1.5 bottom-0 w-0.5 bg-status-gain" style={{ insetInlineStart: pct(sp.unlockAt / 100) }} />
            </span>
            <span className={`text-12 ${sp.state === 'checkIn' ? 'font-600 text-status-decline' : sp.state === 'reward' ? 'font-600 text-status-gain' : 'text-fg-secondary'}`}>
              {t('desk.sponsor.line', { state: sp.state, ...lines })}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
