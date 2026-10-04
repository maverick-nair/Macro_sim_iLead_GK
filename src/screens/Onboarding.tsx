import type { ScreenProps } from '../app/types';
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';
import { isOnboardingStep, type OnboardingMember } from '../components/onboarding/types';
import { ONBOARDING_FIXTURE as FX } from '../data/fixtures';
import { useI18n } from '../i18n';

/**
 * The prototype's onboarding (port of `project/ilOnboarding.dc.html`) on the design fixture, for the
 * `/screens` gallery and the phone prototype. The playable app renders the same flow from the engine
 * (`src/app/EngineOnboarding.tsx`).
 */
export interface OnboardingProps extends ScreenProps {
  /** Initial step: lang, sponsor, consent, voice, how or team. */
  step?: string;
  /** Gallery states: `heard` / `micDenied` (voice), `read` (team). */
  uiState?: string;
}

export function Onboarding({ d: D, act, app, step, uiState }: OnboardingProps) {
  const { t } = useI18n();
  const first = isOnboardingStep(step) ? step : undefined;
  const read = first === 'team' && uiState === 'read';
  const members: OnboardingMember[] = D.members.map(m => ({
    id: m.id, name: m.name, title: m.title, img: `/assets/npc/${m.id}.png`, stage: D.stages[m.stage].n,
    stats: { skill: m.skill, morale: m.morale, result: m.result, trust: m.trust }, read: false,
    facts: { previous: m.prev, tenure: m.tenure, experience: m.exp, skills: m.skills, remarks: m.remarks }
  }));
  return (
    <OnboardingFlow
      initial={{ step: first, voice: uiState === 'heard' ? 'heard' : uiState === 'micDenied' ? 'denied' : 'idle', open: read ? FX.open : undefined, read: read ? [...FX.read] : undefined }}
      minHeight={app.minH}
      teamSize={D.members.length} periods={FX.periods} subPeriodUnit="day" capacity={FX.capacity}
      languages={[...FX.languages]}
      sponsor={{
        name: D.sponsor.name, initials: D.sponsor.initials, img: null,
        role: t('onboarding.sponsor.role', { title: D.sponsor.title, organisation: FX.organisation }),
        letter: { welcome: [...FX.letter.welcome], product: [...FX.letter.product], targets: [...FX.letter.targets] },
        video: FX.video
      }}
      organisation={FX.reportOrganisation}
      sampleName={FX.sampleName}
      members={members}
      onConsent={voice => act.settings(voice ? { voiceConsent: true } : { voiceConsent: false, input: 'text' })}
      onOpenProfile={act.openProfile}
      onSay={act.say}
      onFinish={() => act.go('style')}
    />
  );
}
