import { useEffect, useRef, useState } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { createDemoClient } from '../../engine/client';
import { EngineProvider, useEngineView } from '../../engine/react';
import { rememberedRun } from '../../engine/resilient';
import { useI18n, type MessageKey } from '../../i18n';
import { useUi } from '../../app/uiStore';
import { EngineBoard } from '../board/EngineBoard';
import { AppDialog, DialogDescription, DialogTitle } from '../settings/AppDialog';
import { Coachmark } from '../tour/Coachmark';
import '../tour/messages';
import { DEMO_STEPS, demoStep, demoTarget, type DemoStep } from './demoSteps';

export interface DemoFlowProps {
  /** The run starts: after the demo, or when it is skipped or left. */
  onDone: () => void;
  onPause: () => void;
  onSettings: () => void;
  /** An app dialog (pause, settings) is open over the demo. */
  paused?: boolean;
  minHeight?: string;
  /** Where it starts (stories): the offer, the demo board, or "You are ready". */
  initialStage?: 'offer' | 'run' | 'done';
  /** The demo board fits the window, as the board does (D101). */
  fit?: boolean;
}

const EYEBROW = 'text-12 font-700 tracking-(--il-onboarding-eyebrow-tracking) text-accent-secondary uppercase';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

/**
 * The demo round (D92): offered after onboarding, before the real run. Play the demo opens the board on
 * an engine of its own (the server's demo resource, or a mock engine; the same storyline and a fixed
 * seed), so nothing in it touches the real run's state, log or score. Guided tips walk through one
 * decision: a style, selecting a person, an instant action and its impact. Exit demo asks first (the
 * demo cannot be played again). It ends with "You are ready" and Play simulation.
 */
export default function DemoFlow({ onDone, onPause, onSettings, paused, minHeight, initialStage = 'offer', fit }: DemoFlowProps) {
  const { t } = useI18n();
  const [stage, setStage] = useState<'offer' | 'run' | 'done'>(initialStage);
  const [client] = useState(() => createDemoClient(rememberedRun() ?? 'local'));
  const heading = useRef<HTMLHeadingElement>(null);
  // Each stage starts at its heading, so keyboard and screen reader users begin at the top.
  useEffect(() => { if (stage !== 'run') heading.current?.focus({ preventScroll: true }); }, [stage]);
  const finish = () => { void client.end(); useUi.getState().reset(); onDone(); };

  if (stage === 'run') {
    return (
      <EngineProvider client={client}>
        <DemoRun fit={fit} paused={paused} onPause={onPause} onSettings={onSettings} onFinish={() => { useUi.getState().reset(); setStage('done'); }} onLeave={finish} />
      </EngineProvider>
    );
  }
  const offer = stage === 'offer';
  return (
    <main className="flex flex-1 items-center justify-center p-8" style={{ minHeight }}>
      <div className="flex w-160 max-w-full flex-col gap-5">
        <span className={EYEBROW}>{t(offer ? 'demo.offer.eyebrow' : 'demo.done.eyebrow')}</span>
        <h1 ref={heading} tabIndex={-1} className="m-0 text-40 font-700 tracking-(--il-onboarding-display-tracking) outline-none">{t(offer ? 'demo.offer.title' : 'demo.done.title')}</h1>
        <p className="m-0 text-17 text-pretty text-fg-secondary">{t(offer ? 'demo.offer.body' : 'demo.done.body')}</p>
        {offer && <p className="m-0 text-14 text-fg-secondary">{t('demo.offer.once')}</p>}
        <div className="flex flex-wrap gap-3">
          {offer && <NoWrapButton variant="secondary" size="lg" onClick={finish}>{t('demo.offer.skip')}</NoWrapButton>}
          <NoWrapButton variant="primary" size="lg" onClick={offer ? () => { useUi.getState().reset(); setStage('run'); } : finish}>{t(offer ? 'demo.offer.play' : 'demo.done.play')}</NoWrapButton>
        </div>
      </div>
    </main>
  );
}

/** The demo board with its banner, its tips and the Exit demo confirmation. */
function DemoRun({ fit, paused, onPause, onSettings, onFinish, onLeave }: { fit?: boolean; paused?: boolean; onPause: () => void; onSettings: () => void; onFinish: () => void; onLeave: () => void }) {
  const { t } = useI18n();
  const { data: v } = useEngineView();
  const selected = useUi(s => s.selectedIds[0] ?? null);
  const [confirmExit, setConfirmExit] = useState(false);
  const exitButton = useRef<HTMLButtonElement>(null);
  // What is on screen moves with the board's own state (a style picked, the summary open, the drawer): read it a few times a second.
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(n => n + 1), 250); return () => clearInterval(id); }, []);
  const [prefill, setPrefill] = useState<Record<string, string> | null>(null);
  if (v && !prefill) {
    // Styles for everyone but the person the demo is about, so the demo is one decision, not ten.
    const keys = v.lens.styles.map(s => s.key);
    setPrefill(Object.fromEntries(v.members.filter(m => m.id !== v.guide.demo.with).map((m, i) => [m.id, keys[i % keys.length]])));
  }
  if (!v || !prefill) return <main className="flex flex-1 items-center justify-center"><div role="status" className="text-14 text-fg-secondary">{t('board.loading')}</div></main>;

  const person = v.guide.demo.with ?? v.members[0].id;
  const action = v.guide.demo.action ?? '';
  const name = v.members.find(m => m.id === person)?.name.split(' ')[0] ?? '';
  const act = v.actions.find(a => a.key === action);
  const step: DemoStep | null = confirmExit ? null : demoStep({
    phase: v.phase, outcomeAction: v.outcome?.actionKey ?? null, action,
    personStyled: !!document.querySelector(`[data-member-id="${person}"] [role="radio"][aria-checked="true"]`),
    modalOpen: !!document.querySelector('[role="dialog"][aria-modal="true"]'),
    drawerOpen: !!document.querySelector('[data-drawer]'),
    selected: selected === person
  });
  const target = step ? demoTarget(step, person, action) : null;
  const goThere = () => {
    const el = target ? document.querySelector<HTMLElement>(target) : null;
    const focusable = el?.matches('button, [role="radio"]') ? el : el?.querySelector<HTMLElement>('[role="radio"][tabindex="0"], [role="radio"], button:not([aria-disabled="true"]), button');
    (focusable ?? el)?.focus();
  };
  const banner = (
    <div className="mx-6 mt-3 flex flex-wrap items-center gap-3 rounded-16 border border-accent-default bg-accent-soft py-2 pe-2 ps-4 text-13 font-600">
      <span className="flex-1">{t('demo.banner')}</span>
      <button ref={exitButton} type="button" onClick={() => setConfirmExit(true)}
        className={`min-h-8 cursor-pointer rounded-pill border border-line-strong bg-surface-raised px-3.5 text-13 font-700 text-fg-primary ${FOCUS}`}>{t('demo.exit')}</button>
    </div>
  );
  return (
    <>
      <div className="flex flex-1 flex-col" inert={confirmExit}>
        <EngineBoard demo={{ prefill, banner }} fit={fit} paused={paused || confirmExit} onPause={onPause} onSettings={onSettings} />
      </div>
      {step && (
        <Coachmark target={target} trap={false} stepKey={step} onEscape={() => setConfirmExit(true)}
          counter={t('demo.step', { n: DEMO_STEPS.indexOf(step) + 1, total: DEMO_STEPS.length })}
          title={t(`demo.step.${step}.title` as MessageKey)}
          body={t(`demo.step.${step}.body` as MessageKey, { name, action: act?.name ?? '', cost: t('actions.cost', { whole: Math.floor(act?.cost ?? 0), half: (act?.cost ?? 0) % 1 ? 'yes' : 'no', unit: v.clock.subPeriodUnit }) })}>
          {step === 'impact'
            ? <NoWrapButton variant="primary" size="sm" onClick={onFinish}>{t('demo.step.impact.next')}</NoWrapButton>
            : <NoWrapButton variant="secondary" size="sm" onClick={goThere}>{t('demo.goThere')}</NoWrapButton>}
        </Coachmark>
      )}
      {confirmExit && (
        <AppDialog onDismiss={() => setConfirmExit(false)} returnFocus={() => exitButton.current} described className="flex w-110 flex-col gap-4 p-7">
          <DialogTitle className="m-0 text-24 font-700">{t('demo.exit.title')}</DialogTitle>
          <DialogDescription className="m-0 text-pretty text-fg-secondary">{t('demo.exit.body')}</DialogDescription>
          <div className="flex flex-wrap justify-end gap-2.5">
            <NoWrapButton variant="secondary" size="md" onClick={() => setConfirmExit(false)}>{t('demo.exit.stay')}</NoWrapButton>
            <NoWrapButton variant="primary" size="md" onClick={onLeave}>{t('demo.exit.leave')}</NoWrapButton>
          </div>
        </AppDialog>
      )}
    </>
  );
}
