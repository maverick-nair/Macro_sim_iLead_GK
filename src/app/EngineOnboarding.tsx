import { useEffect, useState } from 'react';
import { useApi } from '../api';
import { tierProgress } from '../components/desk/band';
import { IntroFlow } from '../components/intro/IntroFlow';
import type { OnboardingMember, OnboardingSponsor } from '../components/onboarding/types';
import { useSession, useSignOut } from '../components/session/session';
import { SignedOut } from '../components/session/SignedOut';
import type { EngineView } from '../engine/contract';
import { moneyFormatter } from '../engine/money';
import { useEngineView } from '../engine/react';
import { useI18n, type I18n } from '../i18n';
import { MoneyProvider } from '../i18n/money';
import type { AppActions } from './types';

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
 * The pre-game flow in the playable app (D219): the approved canvas's four screens, landing, the sponsor's video
 * message, the product portfolio when the storyline has one, and the objectives, all from the engine view. The
 * older scenes (the sales floor, how a week works, the voice or text setup, the demo offer and the Week 0 practice offer) are not
 * on this path. Log out saves and leaves to the launch's return address when it gave one, else signs out here.
 */
export function EngineOnboarding({ act }: { act: AppActions; minHeight: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const { data: view } = useEngineView();
  const api = useApi();
  const [exitUrl, setExitUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api.getProfile().then(p => { if (live && p.exit && /^https?:\/\//.test(p.exit)) setExitUrl(p.exit); }, () => undefined);
    return () => { live = false; };
  }, [api]);
  const signOut = useSignOut(exitUrl ? () => location.assign(exitUrl) : undefined);
  const signedOut = useSession(s => s.signedOut);
  const signedOutAt = useSession(s => s.signedOutAt);
  if (!view) return null;
  const { clock, money } = view;
  if (signedOut) {
    const tier = tierProgress(view.score.total, view.gamification.tiers, view.score.tier);
    return (
      <MoneyProvider money={money}>
        <div className="flex min-h-dvh flex-col">
          <SignedOut at={signedOutAt ?? 0} score={{ total: view.score.total, tier: tier?.name ?? null }}
            where={{ period: t('time.period', { unit: clock.periodUnit, n: clock.period }), sub: t('time.subPeriod', { unit: clock.subPeriodUnit, n: clock.subPeriod }), left: t('time.left', { amount: t('time.amount', { unit: clock.subPeriodUnit, n: clock.capacityLeft }) }) }}
            money={{ label: t('board.target', { n: clock.periods, unit: clock.periodUnit }), value: money.value, target: money.target }}
            live={{ used: view.liveCap.used, cap: view.liveCap.cap }} onBack={() => useSession.getState().setSignedOut(false)} />
        </div>
      </MoneyProvider>
    );
  }
  return (
    <IntroFlow view={view} letter={view.storyline.intro ?? engineLetter(i18n, view)}
      onLogOut={() => void signOut()}
      onVoice={() => act.settings({ voiceConsent: true })}
      onText={() => act.settings({ voiceConsent: false, input: 'text' })}
      // Straight to week 1's style setting: the pre-game flow is exactly these four screens (D219), so the demo
      // offer (D92) is off this path even when the storyline has it (`?start=demo` still opens it).
      onStart={() => act.go('style')} />
  );
}
