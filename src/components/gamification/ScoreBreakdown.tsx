import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { currentTier, type Tier } from './display';

export type Pillar = 'business' | 'people' | 'leadership';

export interface ScoreBreakdownProps {
  /** Leadership Score and the top of its scale (`view.score.total`, `view.score.max`). */
  total: number;
  max: number;
  /** The three pillars, 0 to 100 each, with their authored weights (0 to 1). */
  pillars: Array<{ key: Pillar; value: number; weight: number }>;
  /** Contextual capability %, the style fit half of Leadership. */
  capability: number;
  /** Mean live band score, the other half; null before any live conversation. */
  live: number | null;
  /** Streak bonus earned so far, and its cap. */
  bonus: number;
  bonusCap: number;
  /** The streak in one sentence (streakText). */
  streak: string;
  /** Tier names and thresholds, highest first. */
  tiers: Tier[];
  /** The engine's tier, once the run has ended. */
  tier: { key: string; name: string } | null;
  badges: { earned: number; total: number };
  onBadges: () => void;
}

const section = 'text-12 font-700 tracking-(--il-action-section-tracking) text-fg-secondary uppercase';

/**
 * What the Leadership Score is made of, inside the HUD score popover: the three pillars with their
 * weights and what feeds each, the streak bonus, the tiers with where the score sits, and the way
 * to the badge shelf. Every number is the engine's (scoring-and-report.md 6).
 */
export function ScoreBreakdown(p: ScoreBreakdownProps) {
  const { t, number } = useI18n();
  const here = currentTier(p.total, p.tiers, p.tier);
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <b>{t('hud.score.title')}</b>
        <span className="text-12 text-fg-secondary">{t('score.of', { total: number(p.total), max: number(p.max) })}</span>
      </div>
      <span className="text-12 text-fg-secondary">{t('hud.score.body')}</span>
      {p.pillars.map(x => (
        <div key={x.key} className="flex flex-col gap-0.5">
          <span className="sr-only">{t('score.pillar.aria', { pillar: x.key, value: number(x.value), weight: x.weight })}</span>
          <div aria-hidden="true" className="grid grid-cols-(--il-hud-breakdown-columns) items-center gap-2 text-12">
            <span><b>{t('hud.score.pillar', { pillar: x.key })}</b> <span className="text-fg-secondary">{t('score.weight', { weight: x.weight })}</span></span>
            <div className="h-1.5 rounded-3 bg-track">
              <div className="h-full rounded-3 bg-(image:--il-fill-brand)" style={{ width: `${Math.max(0, Math.min(100, x.value))}%` }} />
            </div>
            <b className="text-right">{number(x.value)}</b>
          </div>
          <span className="text-12 text-fg-secondary">{t('score.feeds', { pillar: x.key })}</span>
          {x.key === 'leadership' && <span className="text-12 text-fg-secondary">{t('score.leadership.parts', { capability: number(p.capability), live: p.live === null ? 'none' : number(p.live) })}</span>}
        </div>
      ))}
      <div className="flex flex-col gap-0.5 border-t border-line-default pt-2 text-12">
        <span className="flex items-baseline justify-between gap-2"><b>{t('score.bonus')}</b><b>{t('score.bonus.value', { bonus: number(p.bonus), cap: number(p.bonusCap) })}</b></span>
        <span className="text-fg-secondary">{p.streak}</span>
      </div>
      <div className="flex flex-col gap-1 border-t border-line-default pt-2">
        <span className={section}>{t('score.tiers')}</span>
        <ol className="m-0 flex list-none flex-col gap-0.5 p-0 text-12">
          {p.tiers.map(x => {
            const on = x.key === here;
            return (
              <li key={x.key} aria-current={on || undefined} className={`flex items-center gap-2 rounded-6 px-1.5 py-0.5 ${on ? 'bg-accent-soft text-fg-primary' : 'text-fg-secondary'}`}>
                <span aria-hidden="true" className={`size-1.5 flex-none rounded-round ${on ? 'bg-accent-default' : 'bg-track'}`} />
                <span className={on ? 'font-700' : ''}>{x.name}</span>
                <span className="flex-1" />
                {on && <span className="font-700">{t('score.tier.here', { final: String(!!p.tier) })}</span>}
                <span>{t('score.tier.from', { min: number(x.min) })}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <NoWrapButton variant="secondary" size="sm" onClick={p.onBadges}>{t('score.badges', { earned: p.badges.earned, total: p.badges.total })}</NoWrapButton>
    </>
  );
}
