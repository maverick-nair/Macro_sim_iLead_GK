import { useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { MoneyProvider } from '../../i18n/money';
import { IntroHeader, QUIET_BUTTON } from './IntroHeader';
import { introLogo, introMessage, introProducts, introScreen } from './intro';
import { Landing } from './Landing';
import { Objectives } from './Objectives';
import { Products } from './Products';
import { SponsorMessage } from './SponsorMessage';

export type IntroScreen = 'landing' | 'message' | 'products' | 'objectives';

export interface IntroFlowProps {
  view: EngineView;
  /** The sponsor's welcome letter: the storyline's own, or one worded from its facts. */
  letter: { welcome: string[]; product: string[]; targets: string[] };
  /** Start on this screen (stories and tests). */
  start?: IntroScreen;
  /** The landing's notification delay (0 in stories). */
  noticeAfter?: number;
  autoPlay?: boolean;
  onLogOut: () => void;
  onStart: () => void;
  onVoice: () => void;
  onText: () => void;
}

const initials = (name: string) => { const p = name.trim().split(/\s+/); return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };

const Speaker = ({ muted }: { muted: boolean }) => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9z" />{muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8a5 5 0 0 1 0 8" />}
  </svg>
);

/**
 * The pre-game flow on the engine (D219, the approved canvas): four screens, landing, the sponsor's video message,
 * the product portfolio (only when the storyline has one) and the objectives, then the run. Everything shown comes
 * from the engine view and the catalog; the header offers only Log out (and Mute on the message).
 */
export function IntroFlow({ view, letter, start = 'landing', noticeAfter, autoPlay, onLogOut, onStart, onVoice, onText }: IntroFlowProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const [screen, setScreen] = useState<IntroScreen>(start);
  const [muted, setMuted] = useState(false);
  const { sponsor, storyline, clock, money } = view;
  const words = (n: number) => t('onboarding.number', { n });
  const length = t('intro.length', { words: words(clock.periods), unit: clock.periodUnit, n: clock.periods });
  const size = words(view.members.length);
  const person = { name: sponsor.name, title: sponsor.title, img: sponsor.img, initials: initials(sponsor.name) };
  const products = introProducts(view);
  const message = introMessage(view, letter);
  const logo = introLogo(view);
  const afterMessage = () => setScreen(products.length ? 'products' : 'objectives');

  return (
    <MoneyProvider money={money}>
      <div data-intro={screen} className="flex h-dvh max-h-dvh flex-col overflow-hidden text-large:h-auto text-large:max-h-none text-large:min-h-dvh text-large:overflow-visible">
        <IntroHeader logo={logo} onLogOut={onLogOut}
          extra={screen === 'message' ? (
            <button type="button" aria-pressed={muted} onClick={() => setMuted(m => !m)} className={QUIET_BUTTON}><Speaker muted={muted} />{t('intro.message.mute')}</button>
          ) : undefined} />
        {screen === 'landing' && (
          <Landing title={t('intro.landing.title', { size, length })}
            body={introScreen(view, 'landing') ?? t('intro.landing.body', { size, organisation: storyline.organisation ?? 'none' })}
            facts={[t('intro.landing.fact.time', { length: length.charAt(0).toUpperCase() + length.slice(1) }), t('intro.landing.fact.talk'), t('intro.landing.fact.save')]}
            sponsor={person} noticeAfter={noticeAfter} onWatch={() => setScreen('message')} onSkip={() => setScreen('objectives')} />
        )}
        {screen === 'message' && <SponsorMessage message={message} sponsor={person} muted={muted} hasProducts={products.length > 0} onNext={afterMessage} autoPlay={autoPlay} />}
        {screen === 'products' && <Products products={products} organisation={storyline.organisation} onNext={() => setScreen('objectives')} />}
        {screen === 'objectives' && (
          <Objectives organisation={storyline.organisation} length={length} periods={clock.periods} periodUnit={clock.periodUnit}
            target={money.target} start={money.value} team={view.members.map(m => ({ id: m.id, name: m.name, img: m.img }))} liveCap={view.liveCap.cap}
            weights={view.gamification.weights} sponsor={{ ...person, quote: sponsor.styleLine }}
            onStart={onStart} onVoice={onVoice} onText={onText} />
        )}
      </div>
    </MoneyProvider>
  );
}
