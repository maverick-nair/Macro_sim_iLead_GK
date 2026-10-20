import { useState } from 'react';
import { useI18n } from '../../i18n';
import { LiveAnnouncer } from '../live/LiveAnnouncer';
import type { LivePace, LiveStance } from './types';

const DOT: Record<LiveStance, string> = {
  closing: 'bg-liveshell-stance-closing',
  guarded: 'bg-liveshell-stance-guarded',
  opening: 'bg-liveshell-stance-opening',
  engaged: 'bg-liveshell-stance-engaged'
};

export interface StanceCueProps {
  /** Short name of the person ("Kent"). */
  name: string;
  stance: LiveStance;
  /** `veil`: a navy pill over the portrait's light backdrop. `card`: the tablet's chip on navy. */
  tone?: 'veil' | 'card';
}

/**
 * The live read of the person (D233): a quiet pill under the portrait with where they stand now,
 * from the engine after each of their lines. It settles in when it changes (no motion when motion is
 * reduced), and a polite live region says the change once; the first read is not announced.
 */
export function StanceCue({ name, stance, tone = 'veil' }: StanceCueProps) {
  const { t } = useI18n();
  const [seen, setSeen] = useState(stance);
  const [moved, setMoved] = useState(false);
  if (stance !== seen) {
    // A new read: announce it from now on (state adjusted while rendering, as React suggests for derived state).
    setSeen(stance);
    setMoved(true);
  }
  const look = tone === 'veil'
    ? 'bg-(--il-canvas-veil-soft) text-(--il-color-white)'
    : 'border border-line-default bg-surface-card text-fg-primary';
  return (
    <>
      <span key={stance} data-testid="live-stance" data-stance={stance}
        className={`flex min-h-7 animate-(--il-liveshell-roleplay-stance-enter) items-center gap-2 self-center rounded-4 px-3 text-13 font-500 ${look}`}>
        <span className="sr-only">{t('liveshell.roleplay.stanceLabel', { name })}</span>
        <span aria-hidden="true" className={`size-2 flex-none rounded-round ${DOT[stance]}`} />
        <span>{t('liveshell.roleplay.stance', { stance })}</span>
      </span>
      <LiveAnnouncer text={moved ? t('liveshell.roleplay.stanceAnnounce', { name, stance }) : ''} />
    </>
  );
}

/** Near the end, once few exchanges are left: two of twelve, one of four (D233). */
const wrapsAt = (limit: number) => Math.min(2, Math.floor(limit / 3));

export interface LivePacingProps {
  pace: LivePace;
  /** Your goal, kept in view beside the conversation in one or two lines (D233). */
  goal?: string;
}

/**
 * Where the conversation is (D233): a slim track of the exchanges used and plain words ("About 3 more
 * exchanges", then "Time to agree next steps"). "About", because the person may close it sooner. The
 * track is decoration: the words carry it.
 */
export function LivePacing({ pace, goal }: LivePacingProps) {
  const { t } = useI18n();
  const limit = Math.max(1, pace.turnLimit);
  const left = Math.max(0, Math.min(limit, pace.turnsLeft));
  const over = pace.closed || left === 0;
  const wrap = !over && left <= wrapsAt(limit);
  const words = over ? t('liveshell.pace.over') : wrap ? t('liveshell.pace.wrap') : t('liveshell.pace.left', { n: left });
  const share = over ? 1 : (limit - left) / limit;
  return (
    <div data-testid="live-pace" className="flex flex-none flex-col gap-2 short:gap-1.5">
      {goal && <p className="m-0 line-clamp-2 text-13 text-pretty text-fg-secondary">{t('liveshell.brief.goalLine', { goal })}</p>}
      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="h-1 min-w-0 flex-1 overflow-hidden rounded-round bg-line-default">
          <div className={`h-full rounded-round [transition:var(--il-liveshell-pace-transition)] ${wrap || over ? 'bg-status-attention' : 'bg-accent-default'}`}
            style={{ inlineSize: `${Math.round(share * 100)}%` }} />
        </div>
        <span data-pace={over ? 'over' : wrap ? 'wrap' : 'left'} className={`flex-none text-13 ${wrap ? 'font-600 text-fg-primary' : 'text-fg-secondary'}`}>{words}</span>
      </div>
    </div>
  );
}
