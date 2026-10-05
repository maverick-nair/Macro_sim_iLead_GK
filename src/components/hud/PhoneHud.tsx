import { useId, type ReactNode } from 'react';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import type { HudProps } from './Hud';

/** Private use character that marks where a formatted value sits inside a message. */
const MARK = '\uE000';
function around(message: string, wrap: (node: ReactNode) => ReactNode, value: ReactNode): ReactNode {
  const [before, after = ''] = message.split(MARK);
  return <>{before || null}{wrap(value)}{after || null}</>;
}

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const round = `flex size-11 flex-none cursor-pointer items-center justify-center rounded-round border border-solid border-line-default bg-surface-raised p-0 text-fg-primary ${focus}`;

const Bolt = ({ left }: { left: number }) => {
  const fill = left >= 1 ? 'fill-hud-capacity-full' : left > 0 ? 'fill-hud-capacity-half' : 'fill-transparent';
  const stroke = left > 0 ? 'stroke-hud-capacity-full' : 'stroke-hud-capacity-empty';
  return (
    <svg className="h-4.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" className={`${fill} ${stroke}`} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};
const Star = () => {
  const id = 'il-phone-score-' + useId().replace(/[^\w-]/g, '');
  return (
    <svg className="size-4.5" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--il-color-brand-electric-blue)' }} />
          <stop offset="1" style={{ stopColor: 'var(--il-color-brand-mint-green)' }} />
        </linearGradient>
      </defs>
      <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3" fill={`url(#${id})`} />
    </svg>
  );
};
const Flame = () => (
  <svg className="size-4 fill-hud-streak stroke-hud-streak" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);
const Sliders = () => (
  <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
  </svg>
);
const Pause = () => (
  <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
);

/**
 * The HUD on a phone (390): two rows in the design's phone header language (frame m6). First where
 * the run is, the Leadership Score, the streak and settings; then capacity left, Pause and End week.
 * The score opens its breakdown in a sheet (`onScoreOpenChange(true)`) instead of a hover popover, and
 * there is no Cmd K: phones have no keyboard shortcut to show. Every target is at least 44px.
 */
export function PhoneHud(p: HudProps) {
  const { t, number } = useI18n();
  const { clock, score } = p;
  const left = clock.capacityLeft;
  const amount = t('time.amountHalves', { unit: clock.subPeriodUnit, whole: Math.floor(left), half: left % 1 ? 'yes' : 'no' });
  const capAria = t('time.capacityAria', { left, total: clock.capacity, unit: clock.subPeriodUnit, period: clock.periodUnit });
  const slots = Array.from({ length: Math.ceil(clock.capacity) }, (_, i) => Math.max(0, Math.min(1, left - i)));
  const periodText = t('time.period', { unit: clock.periodUnit, n: clock.period });
  const where = t('hud.clock', { period: MARK, subPeriod: t('time.subPeriod', { unit: clock.subPeriodUnit, n: clock.subPeriod }) });
  const streak = p.streakLabel ?? t('hud.streak', { n: number(p.streak), unit: clock.periodUnit });

  return (
    <header className="flex flex-col gap-2 px-(--il-phone-gutter-x) pt-(--il-phone-top) pb-3">
      <div className="flex min-h-11 items-center gap-2">
        {p.clientLogo && <div className="flex min-h-7 items-center rounded-6 border border-dashed border-line-strong px-2 text-12 text-fg-secondary">{t('hud.clientLogo')}</div>}
        <span className="bg-(image:--il-fill-brand) bg-clip-text text-20 font-700 tracking-(--il-hud-logo-tracking) text-transparent">{t('hud.logo')}</span>
        <span className="min-w-0 flex-1 text-13 text-fg-secondary">{around(where, v => <b className="text-fg-primary">{v}</b>, periodText)}</span>
        <button type="button" aria-label={t('hud.score.aria', { total: number(score.total) })} aria-haspopup="dialog" aria-expanded={!!p.scoreOpen}
          onClick={() => p.onScoreOpenChange?.(true)}
          className={`flex min-h-11 flex-none cursor-pointer items-center gap-1.5 rounded-pill border-0 bg-transparent px-2 py-0 text-15 font-700 text-fg-primary ${focus}`}>
          <Star />{number(score.total)}
        </button>
        <span role="img" aria-label={streak} className="flex flex-none items-center gap-1 text-15 font-700"><Flame />{number(p.streak)}</span>
        <button type="button" onClick={p.onSettings} aria-label={t('hud.settings.aria')} className={round}><Sliders /></button>
      </div>
      <div className="flex min-h-11 items-center gap-2">
        <div role="group" aria-label={capAria} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <div className="flex gap-0.25">{slots.map((v, i) => <Bolt key={i} left={v} />)}</div>
          <span className="text-13 text-fg-secondary">{around(t('time.left', { amount: MARK }), v => <b className="text-fg-primary">{v}</b>, amount)}</span>
        </div>
        <button type="button" onClick={p.onPause} aria-label={t('hud.pause.aria')} className={round}><Pause /></button>
        <span className="inline-flex flex-none whitespace-nowrap">
          <Button variant={p.endEmphasis} size="lg" onClick={p.onEndPeriod}>
            {around(t('time.endPeriodNumber', { unit: clock.periodUnit, n: MARK }), v => <span>{v}</span>, number(clock.period))}
          </Button>
        </span>
      </div>
    </header>
  );
}
