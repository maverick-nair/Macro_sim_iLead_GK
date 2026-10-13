import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { useDays, type SubPeriodUnit } from '../action/days';
import { LiveBriefCard } from './LiveBriefCard';
import { LiveInputBar, type LiveInputBarProps } from './LiveInputBar';
import { FOCUS, type LiveBrief, type LiveFormat, type LiveMode } from './types';

export interface LiveTimer {
  /** Seconds left (`counts: 'down'`, the default) or elapsed (`counts: 'up'`). */
  seconds: number;
  counts?: 'down' | 'up';
  /** The interaction clock is paused: the button resumes it. */
  paused: boolean;
}

export interface LiveHint {
  /** False once the one tip per interaction is used, or while it cannot be asked for. */
  available: boolean;
  /** The coaching tip, once requested. Shown in the brief. */
  text: string | null;
  onRequest: () => void;
}

/** The End button: `end`, `discard` (an unsent email) or `finish` (the conversation reached a natural close). */
export type LiveEndKind = 'end' | 'discard' | 'finish';

export interface LiveShellProps {
  format: LiveFormat;
  /** Who the interaction is with, for the title ("1:1 with Kent Goldberg"). Unused for a team meeting. */
  personName: string;
  /** Pronoun of that person, for the brief ("Your style for him"). */
  pronoun?: 'he' | 'she' | 'they';
  /**
   * The line under the title. `cost` is in the storyline's sub period (`costUnit`, days by default):
   * "Meet face to face · ½ day", "Agenda: the Ashcroft discount · 1 day", "No days used".
   * `action` names the action a 1:1 came from ("Coach member · 1 day"); without it the 1:1 reads "Meet face to face".
   * The sponsor briefing shows `minutes` instead ("Q and A · about 6 minutes").
   */
  meta: { cost: number; costUnit?: SubPeriodUnit; topic?: string; minutes?: number; action?: string };
  timer: LiveTimer;
  /** Pauses or resumes the interaction clock. */
  onPause: () => void;
  mode: LiveMode;
  onModeChange: (mode: LiveMode) => void;
  /** Null hides the hint button (formats without coaching). */
  hint: LiveHint | null;
  endKind: LiveEndKind;
  onEnd: () => void;
  /** Connection lost: the banner under the header. */
  offline?: boolean;
  brief: LiveBrief;
  briefOpen: boolean;
  onBriefToggle: () => void;
  /** The reply bar under the stage. Null for formats with their own send (email). */
  input: Omit<LiveInputBarProps, 'mode' | 'onModeChange' | 'onInterrupt'> | null;
  /** Stops the NPC's current turn: speaking into the mic, or Escape anywhere in the shell. */
  onInterrupt?: () => void;
  /** The format's workspace: RolePlayStage, EmailStage, MeetingStage or SponsorStage. */
  children: ReactNode;
  /**
   * `tablet`: the portrait tablet's live screen (D73): one column, the brief above the stage with the
   * goal always showing (or beside the 1:1 portrait, `briefInStage`), the 56px voice composer.
   */
  layout?: 'desk' | 'tablet';
  /** The stage shows the brief itself (the 1:1 on a tablet, beside the portrait). */
  briefInStage?: boolean;
  /**
   * The 1:1 on a desk (D227): the person's portrait fills the left column, with the brief over it,
   * and the conversation and reply bar take the right. Leave it out for the brief beside the stage.
   */
  portrait?: ReactNode;
}

const ClockIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2M10 2h4" />
  </svg>
);

const PauseIcon = () => (
  <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="5" y="4" width="5" height="16" rx="1" />
    <rect x="14" y="4" width="5" height="16" rx="1" />
  </svg>
);

const PlayIcon = () => (
  <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
  </svg>
);

const MODES: LiveMode[] = ['voice', 'text'];

/** Voice or text, any time. A radio group: arrow keys move and pick. In the header only when there is no reply bar (which carries its own switch). */
function ModeSwitch({ mode, onChange }: { mode: LiveMode; onChange: (m: LiveMode) => void }) {
  const { t } = useI18n();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (MODES.indexOf(mode) + step + MODES.length) % MODES.length;
    onChange(MODES[next]);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" tabIndex={-1} aria-label={t('liveshell.mode.aria')} onKeyDown={onKey}
      className="flex gap-0.5 rounded-4 border border-line-strong p-0.75">
      {MODES.map((m, i) => {
        const on = mode === m;
        return (
          <button key={m} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onChange(m)}
            className={`min-h-9 cursor-pointer rounded-4 border-0 px-3 py-0 text-13 font-500 ${on ? 'bg-surface-raised text-fg-primary' : 'bg-transparent text-fg-secondary'} ${FOCUS}`}>
            {t('liveshell.mode.option', { mode: m })}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The shell every live format shares: the header (format and person, the interaction clock with
 * pause, hint, voice or text, End), the offline banner, the collapsible brief, the format's stage
 * and the reply bar. Escape interrupts the NPC while it speaks.
 */
export function LiveShell(p: LiveShellProps) {
  const { t } = useI18n();
  const days = useDays(p.meta.costUnit);
  const secs = Math.max(0, Math.round(p.timer.seconds));
  const time = t('liveshell.timer.value', { minutes: Math.floor(secs / 60), seconds: String(secs % 60).padStart(2, '0') });
  const npcSpeaking = p.input?.conversation === 'npcSpeaking';
  const tablet = p.layout === 'tablet';
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && npcSpeaking && p.onInterrupt) {
      e.preventDefault();
      p.onInterrupt();
    }
  };
  const direction = p.timer.counts === 'up' ? 'elapsed' : 'left';
  const split = !tablet && !!p.portrait;
  const replyBar = p.input && <LiveInputBar {...p.input} mode={p.mode} onModeChange={p.onModeChange} onInterrupt={p.onInterrupt} layout={p.layout} />;
  return (
    // Escape anywhere in the shell interrupts the NPC; the controls inside stay the interactive elements.
    // The live screens are the canvas's navy room in both modes (D227).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div onKeyDown={onKeyDown} className="il-scheme-dark flex flex-1 flex-col bg-(--il-color-canvas-navy) text-fg-primary">
      <header className="il-chrome flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-8 py-2.5 tablet:px-5 tablet-portrait:min-h-18 tablet-portrait:gap-3 tablet-portrait:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-5 gap-y-0.5">
          <span className="text-12 font-600 tracking-(--il-tracking-eyebrow-wide) text-(--il-color-canvas-mint) uppercase">
            {p.meta.action && p.format === 'roleplay'
              ? t('liveshell.subtitle.action', { action: p.meta.action, cost: days(p.meta.cost) })
              : t('liveshell.subtitle', { format: p.format, cost: days(p.meta.cost), topic: p.meta.topic ?? '', minutes: p.meta.minutes ?? 0 })}
          </span>
          <b className="truncate text-15 font-400 tablet-portrait:text-17">{t('liveshell.title', { format: p.format, name: p.personName })}</b>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-14 whitespace-nowrap" aria-hidden="true">
          <ClockIcon />{t('liveshell.timer.left', { time, direction })}
        </span>
        <span className="text-12 text-fg-secondary tablet-portrait:hidden">{t('liveshell.clock.paused')}</span>
        <button type="button" onClick={p.onPause} aria-label={t('liveshell.timer.aria', { paused: p.timer.paused, time, direction })}
          className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-4 border border-solid border-line-strong bg-transparent px-3.5 py-0 text-14 font-500 text-fg-primary hover:border-line-control ${FOCUS}`}>
          {p.timer.paused ? <PlayIcon /> : <PauseIcon />}
          <span>{t('liveshell.timer.button', { paused: p.timer.paused })}</span>
        </button>
        {p.hint && (
          <button type="button" onClick={p.hint.onRequest} disabled={!p.hint.available} data-tour="live-hint"
            className={`min-h-11 cursor-pointer rounded-4 border border-solid border-line-strong bg-transparent px-3.5 py-0 text-14 font-500 hover:border-line-control disabled:cursor-default ${p.hint.text !== null ? 'text-fg-secondary' : 'text-fg-primary'} ${FOCUS}`}>
            {t('liveshell.hint.button', { used: p.hint.text !== null })}
          </button>
        )}
        {!p.input && <ModeSwitch mode={p.mode} onChange={p.onModeChange} />}
        <span data-tour="live-end" className="inline-flex flex-none">
          <NoWrapButton variant={p.endKind === 'discard' ? 'secondary' : 'primary'} size="md" onClick={p.onEnd}>
            {t('liveshell.end', { kind: p.endKind })}
          </NoWrapButton>
        </span>
      </header>

      {p.offline && (
        <div role="alert" className="border-b border-status-attention bg-status-attention-soft px-8 py-2.5 text-13">
          <b>{t('liveshell.offline.title')}</b> {t('liveshell.offline.body')}
        </div>
      )}

      {split ? (
        <div className="grid min-h-0 flex-1 grid-cols-(--il-canvas-live-columns)">
          <div className="relative min-h-0 border-e border-line-default">{p.portrait}</div>
          <section aria-label={t('liveshell.stage.aria')} className="@container flex min-h-0 min-w-0 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-10 pt-6 pb-4 tablet:px-6">{p.children}</div>
            {replyBar && <div data-tour="live-input" className="flex flex-none flex-col border-t border-line-default px-10 pt-4 pb-5 tablet:px-6">{replyBar}</div>}
          </section>
        </div>
      ) : (
        <div className={tablet ? 'flex min-h-0 flex-1 flex-col gap-4 px-6 pt-5 pb-7' : `grid min-h-0 flex-1 ${p.briefOpen ? 'grid-cols-(--il-liveshell-body-columns-brief)' : 'grid-cols-(--il-liveshell-body-columns-collapsed)'} gap-6 px-8 pt-6 pb-6 tablet:px-5`}>
          {!(tablet && p.briefInStage) && <div data-tour="live-brief" className="flex min-h-0 flex-col"><LiveBriefCard format={p.format} brief={p.brief} pronoun={p.pronoun} tip={p.hint?.text ?? null} open={p.briefOpen} onToggle={p.onBriefToggle} layout={p.layout} /></div>}
          <section aria-label={t('liveshell.stage.aria')} className={`@container flex min-h-0 min-w-0 flex-col gap-3.5 ${tablet ? 'flex-1' : ''}`}>
            {p.children}
            {replyBar && <div data-tour="live-input" className="flex flex-none flex-col">{replyBar}</div>}
          </section>
        </div>
      )}
    </div>
  );
}
