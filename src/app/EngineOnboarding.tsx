import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';
import type { OnboardingMember, OnboardingSponsor } from '../components/onboarding/types';
import type { EngineView } from '../engine/contract';
import { moneyFormatter } from '../engine/money';
import { useEngineView, useIntent } from '../engine/react';
import { useI18n, type I18n } from '../i18n';
import type { AppActions } from './types';
import { useUi } from './uiStore';

/** Initials for the sponsor's placeholder when the storyline has no portrait: first and last name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toLocaleUpperCase();
}

/**
 * The welcome letter for a storyline without an authored one, from what the engine view knows: the
 * organisation, team size, stages, role coverage, target, run length and time per period.
 */
export function engineLetter({ t, locale }: I18n, view: EngineView): OnboardingSponsor['letter'] {
  const words = (n: number) => t('onboarding.number', { n });
  const { clock, funnel, money } = view;
  const length = t('onboarding.duration', { words: words(clock.periods), unit: clock.periodUnit, n: clock.periods });
  return {
    welcome: [
      t('onboarding.sponsor.welcome.1', { organisation: view.storyline.organisation ?? 'none' }),
      t('onboarding.sponsor.welcome.2', { size: words(view.members.length) }),
      t('onboarding.sponsor.welcome.3')
    ],
    product: [
      t('onboarding.sponsor.product.1', { count: words(funnel.length), stages: new Intl.ListFormat(locale, { type: 'conjunction' }).format(funnel.map(f => f.name)) }),
      t('onboarding.sponsor.product.2', { max: view.maxPerStage, maxWords: words(view.maxPerStage) })
    ],
    targets: [
      t('onboarding.sponsor.targets.1', { target: moneyFormatter(money).format(money.target), length }),
      t('onboarding.sponsor.targets.2'),
      t('onboarding.sponsor.targets.3', { amount: t('onboarding.duration', { words: words(clock.capacity), unit: clock.subPeriodUnit, n: clock.capacity }), unit: clock.periodUnit })
    ]
  };
}

/** Onboarding members from the engine view: stage names from the funnel, stats only once revealed. */
export function engineMembers({ t }: I18n, view: EngineView): OnboardingMember[] {
  const stage = (key: string) => view.funnel.find(f => f.key === key)?.name ?? key;
  const fact = (key: 'previous' | 'tenure' | 'experience' | 'skills' | 'remarks', v: string) => v.trim() || t('profile.fact.empty', { key });
  return view.members.map(m => ({
    id: m.id, name: m.name, title: m.title, img: m.img, stage: stage(m.stage),
    stats: m.statsRevealed && m.skill !== null && m.morale !== null && m.result !== null && m.trust !== null ? { skill: m.skill, morale: m.morale, result: m.result, trust: m.trust } : null,
    read: m.statsRevealed,
    facts: { previous: fact('previous', m.profile.previous), tenure: fact('tenure', m.profile.tenure), experience: fact('experience', m.profile.experience), skills: fact('skills', m.profile.skills), remarks: fact('remarks', m.profile.remarks) }
  }));
}

/**
 * Onboarding in the playable app: the running storyline's sponsor, organisation, stages and team,
 * from the engine view. Opening a profile sends `openProfile`, so its stats show on the board too.
 * The storyline has no welcome video, so the sponsor step shows the letter only.
 */
export function EngineOnboarding({ act, minHeight }: { act: AppActions; minHeight: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const { data: view } = useEngineView();
  const { mutate } = useIntent();
  const offerPractice = useUi(s => s.setPracticeOffer);
  if (!view) return null;
  const { sponsor, storyline, clock } = view;
  return (
    <OnboardingFlow
      minHeight={minHeight}
      teamSize={view.members.length} periods={{ unit: clock.periodUnit, count: clock.periods }} subPeriodUnit={clock.subPeriodUnit} capacity={clock.capacity}
      // One language is configured, so the language picker stays hidden (spec, onboarding step 1).
      languages={[]}
      sponsor={{
        name: sponsor.name, initials: initials(sponsor.name), img: sponsor.img,
        role: t('onboarding.sponsor.role', { title: sponsor.title, organisation: storyline.organisation ?? 'none' }),
        letter: storyline.intro ?? engineLetter(i18n, view), video: null
      }}
      organisation={storyline.organisation}
      sampleName={view.members[0]?.name.split(' ')[0] ?? ''}
      members={engineMembers(i18n, view)}
      onConsent={voice => act.settings(voice ? { voiceConsent: true } : { voiceConsent: false, input: 'text' })}
      onOpenProfile={id => { if (!view.members.find(m => m.id === id)?.statsRevealed) mutate({ type: 'openProfile', memberId: id }); }}
      onSay={act.say}
      // The demo round is offered next when the storyline has it (D92); then the Week 0 practice, above week 1's style setting (D16, D84).
      onFinish={() => { if (view.guide.demo.enabled) act.go('demo'); else { offerPractice(true); act.go('style'); } }}
      liveVoice
    />
  );
}
