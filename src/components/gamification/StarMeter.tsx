import { useId } from 'react';
import { useI18n } from '../../i18n';

export const STAR_POINTS = '12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3';

export interface StarMeterProps {
  /** Stars earned this week, from the engine. */
  earned: number;
  /** Stars available, 3 in the design. */
  total?: number;
}

/**
 * The week end banner's stars: earned ones on the spectrum gradient, the rest outlined.
 * They rise in one after another (instant under reduced motion). Each instance owns its
 * gradient ids, since the gallery renders many banners on one page.
 */
export function StarMeter({ earned, total = 3 }: StarMeterProps) {
  const { t } = useI18n();
  const uid = useId().replace(/:/g, '');
  return (
    <div role="img" aria-label={t('gamification.stars.aria', { earned, total })} className="il-burst relative flex gap-3.5">
      {Array.from({ length: total }, (_, i) => {
        const on = i < earned;
        const gid = `${uid}wg${i}`;
        return (
          <svg key={i} className="size-16 animate-(--il-gamification-star-enter)" style={{ animationDelay: `calc(${i} * var(--il-gamification-star-stagger))` }} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--il-color-brand-electric-blue)" />
                <stop offset=".5" stopColor="var(--il-color-brand-cyber-cyan)" />
                <stop offset="1" stopColor="var(--il-color-brand-mint-green)" />
              </linearGradient>
            </defs>
            <polygon points={STAR_POINTS} fill={on ? `url(#${gid})` : 'transparent'} stroke={on ? 'transparent' : 'var(--il-color-line-control)'} strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        );
      })}
    </div>
  );
}

export type StarKind = 'people' | 'leadership' | 'business';

export interface StarRowProps {
  /** People, Leadership or Business, as the design shows them. */
  kind?: StarKind;
  /** A title of the caller's own, in place of the kind's (it must say whether the star is earned). */
  title?: string;
  earned: boolean;
  /** Why it was earned, or what it needed. Engine text. */
  detail: string;
}

/** One star in the weekly report: People, Leadership or Business, earned or "not yet". */
export function StarRow({ kind, title, earned, detail }: StarRowProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3">
      <svg className="size-6.5" viewBox="0 0 24 24" aria-hidden="true">
        <polygon points={STAR_POINTS} fill={earned ? 'var(--il-color-celebration-star)' : 'transparent'} stroke={earned ? 'var(--il-color-celebration-star)' : 'var(--il-color-line-control)'} strokeWidth="1.5" />
      </svg>
      <span className="flex flex-col">
        <b className="text-14 font-700">{title ?? t('gamification.star.title', { kind: kind ?? 'other', earned: String(earned) })}</b>
        <span className="text-12 text-fg-secondary">{detail}</span>
      </span>
    </div>
  );
}
