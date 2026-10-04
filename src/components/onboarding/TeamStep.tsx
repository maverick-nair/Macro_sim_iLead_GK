import { useId } from 'react';
import { NoWrapButton } from '../../ds/Button';
import type { MetricKey } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { FOCUS, HEADING } from './OnboardingSteps';
import { ONBOARDING_FACTS, type OnboardingMember } from './types';

export interface TeamStepProps {
  members: OnboardingMember[];
  /** Ids whose profile has been read, here or before. */
  read: string[];
  /** The profile showing on the right. */
  open: string | null;
  /** Profiles to read before the first period can start (3, as in iLead 1.0). */
  readsNeeded: number;
  /** "Start week 1". */
  startLabel: string;
  onOpen: (id: string) => void;
  onStart: () => void;
}

const STATS: MetricKey[] = ['skill', 'morale', 'result', 'trust'];

/**
 * Step 6: the team, five to a row, with the profile of whoever is open on the right. Stats show once
 * a profile has been read; reading enough profiles unlocks the first period.
 */
export function TeamStep({ members, read, open, readsNeeded, startLabel, onOpen, onStart }: TeamStepProps) {
  const { t, number } = useI18n();
  const profileId = useId();
  const op = members.find(m => m.id === open) ?? null;
  const readCount = members.filter(m => read.includes(m.id)).length;
  return (
    <div className="grid flex-1 animate-(--il-onboarding-enter) grid-cols-(--il-onboarding-team-columns) gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 tabIndex={-1} className={`${HEADING} text-32 tracking-(--il-onboarding-title-tracking)`}>{t('onboarding.team.title')}</h1>
            <span className="text-fg-secondary">{t('onboarding.team.hint', { count: readsNeeded })}</span>
          </div>
          <div className="flex items-center gap-3.5">
            <span aria-live="polite" className="font-700">{t('onboarding.team.read', { read: Math.min(readsNeeded, readCount), count: readsNeeded })}</span>
            <NoWrapButton variant="primary" size="lg" disabled={readCount < readsNeeded} onClick={onStart}>{startLabel}</NoWrapButton>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3.5">
          {members.map(m => {
            const isRead = read.includes(m.id);
            const stats = isRead ? m.stats : null;
            return (
              <button key={m.id} type="button" onClick={() => onOpen(m.id)} aria-controls={profileId}
                aria-label={t('onboarding.team.member.aria', { name: m.name, stage: m.stage, read: isRead ? 'yes' : 'no' })}
                className={`flex cursor-pointer flex-col overflow-hidden rounded-20 border-2 border-solid bg-surface-card p-0 text-left text-fg-primary [transition:var(--il-onboarding-team-card-transition)] hover:[transform:var(--il-onboarding-team-card-lift)] ${FOCUS} ${open === m.id ? 'border-accent-secondary' : 'border-line-default'}`}>
                <div className="relative h-37.5 w-full bg-(image:--il-fill-portrait-calm)">
                  {m.img && <img src={m.img} alt="" className="size-full object-cover object-(--il-onboarding-team-portrait-position) mix-blend-multiply" />}
                  {isRead && <span className="absolute top-2 right-2 flex min-h-5.5 items-center rounded-pill bg-brand-mint-green px-2 text-12 font-700 text-brand-deep-space">{t('onboarding.team.readBadge')}</span>}
                </div>
                <div className="flex flex-col px-3 py-2.5">
                  <b className="text-14">{m.name}</b>
                  <span className="text-12 text-fg-secondary">{m.stage}</span>
                  <span className="pt-1 text-12 text-fg-secondary">{stats ? t('onboarding.team.stats', { ...stats }) :t('onboarding.team.statsHidden')}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <aside id={profileId} aria-label={t('onboarding.team.profile.aria')} className="flex flex-col overflow-hidden rounded-24 border border-line-strong bg-surface-material">
        {op && (
          <>
            <div className="flex items-center gap-4 px-5 pt-5.5 pb-1">
              <div className="size-28 flex-none overflow-hidden rounded-round bg-(image:--il-fill-portrait-calm) shadow-(--il-profile-portrait-ring)">
                {op.img && <img src={op.img} alt={op.name} className="size-full object-cover object-top mix-blend-multiply" />}
              </div>
              <div className="flex flex-col">
                <b className="text-22">{op.name}</b>
                <span className="text-13 text-fg-secondary">{op.title}</span>
              </div>
            </div>
            <div className="flex animate-(--il-onboarding-profile-enter) flex-col gap-3 px-5 py-4.5">
              <div className="grid grid-cols-(--il-onboarding-profile-stats-columns) gap-2">
                {STATS.map(k => (
                  <div key={k} className="flex flex-col rounded-12 bg-surface-raised p-2">
                    <span className="text-12 text-fg-secondary">{t('metric.name', { metric: k })}</span>
                    <b className="text-18">{op.stats && read.includes(op.id) ? number(op.stats[k]) : null}</b>
                  </div>
                ))}
              </div>
              {ONBOARDING_FACTS.map(k => (
                <div key={k} className="grid grid-cols-(--il-onboarding-profile-fact-columns) gap-2.5 text-13">
                  <span className="text-fg-secondary">{t('onboarding.team.fact', { key: k })}</span>
                  <span>{op.facts[k]}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {!op && <div className="flex flex-1 items-center justify-center p-8 text-center text-fg-secondary">{t('onboarding.team.profile.empty')}</div>}
      </aside>
    </div>
  );
}
