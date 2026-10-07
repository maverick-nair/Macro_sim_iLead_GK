import { useEffect, useMemo, useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { useI18n, type MessageKey } from '../../i18n';
import { inertOutside } from '../../lib/inertOutside';
import { Coachmark } from './Coachmark';
import { findTarget, TOURS, type TourArea } from './steps';
import './messages';

export type TourEnd = 'done' | 'skip' | 'never';

export interface TourProps {
  area: TourArea;
  view: Pick<EngineView, 'lens' | 'clock' | 'guide' | 'gamification' | 'funnel'>;
  onEnd: (how: TourEnd) => void;
}

const BUTTON = 'min-h-9 cursor-pointer rounded-pill px-3.5 text-13 font-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

/**
 * A guided tour (D94): one tip at a time over what it explains, Back and Next, Skip, and "Do not show tips
 * again". Lens aware: the style steps name the lens and its styles. A storyline may reword any step.
 * The board behind is inert while it runs, and the session clock holds (the board pauses it).
 */
export default function Tour({ area, view, onEnd }: TourProps) {
  const { t, locale } = useI18n();
  const steps = TOURS[area];
  // Targets can arrive a moment after the screen (the actions panel renders after the first paint).
  const [, setTick] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setTick(n => n + 1)); return () => cancelAnimationFrame(id); }, []);
  const available = steps.filter(s => findTarget(s) !== null);
  const [index, setIndex] = useState(0);
  const step = available[Math.min(index, available.length - 1)];

  // Everything but the tip is inert while the tour runs: no stray clicks on the board behind it.
  useEffect(() => {
    const tip = document.querySelector<HTMLElement>('[data-tour-root]');
    return tip ? inertOutside(tip) : undefined;
  }, []);

  const params = useMemo(() => {
    const { clock, lens } = view;
    const names = new Intl.ListFormat(locale, { type: 'conjunction' }).format(lens.styles.map(s => s.name));
    return {
      unit: clock.periodUnit, sub: clock.subPeriodUnit, n: clock.period, total: clock.periods, cap: clock.capacity,
      stages: view.funnel.length, lens: lens.title, count: lens.styles.length, names,
      leaderboard: view.gamification.leaderboard.enabled ? 'yes' : 'no'
    };
  }, [view, locale]);

  if (!step) return <div data-tour-root="" />;
  const own = view.guide.tour.steps[`${area}.${step.key}`];
  const title = own?.title ?? t(`tour.${area}.${step.key}.title` as MessageKey, params);
  const body = own?.body ?? t(`tour.${area}.${step.key}.body` as MessageKey, params);
  const last = index >= available.length - 1;
  return (
    <div data-tour-root="">
      <Coachmark target={findTarget(step)} title={title} body={body} stepKey={step.key} onEscape={() => onEnd('skip')}
        counter={t('tour.counter', { n: Math.min(index, available.length - 1) + 1, total: available.length, area })}
        footer={<button type="button" onClick={() => onEnd('never')} className={`${BUTTON} min-h-8 border-0 bg-transparent px-1 font-600 text-fg-secondary hover:text-fg-primary`}>{t('tour.never')}</button>}>
        <button type="button" onClick={() => onEnd('skip')} className={`${BUTTON} me-auto border-0 bg-transparent px-1 text-fg-secondary hover:text-fg-primary`}>{t('tour.skip')}</button>
        {index > 0 && <button type="button" onClick={() => setIndex(i => Math.max(0, i - 1))} className={`${BUTTON} border border-line-strong bg-surface-raised text-fg-primary`}>{t('tour.back')}</button>}
        <button type="button" onClick={() => (last ? onEnd('done') : setIndex(i => i + 1))} className={`${BUTTON} border-0 bg-(image:--il-fill-brand) text-brand-deep-space`}>
          {last ? t('tour.done') : t('tour.next')}
        </button>
      </Coachmark>
    </div>
  );
}
