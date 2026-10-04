import { useI18n } from '../../i18n';
import { useMoney } from '../../i18n/money';
import type { PeriodUnit } from '../action/days';
import { LiveCaption } from '../live/LiveCaption';
import { initialsOf, shortNameOf, type LiveCaptionLine, type LiveLayout, type LivePerson } from './types';

export interface SponsorFunnelStage {
  key: string;
  /** Stage name from the storyline. */
  name: string;
  count: number;
  ideal: number;
}

export interface SponsorNote {
  value: string;
  /** Authored prompt shown while the note is empty ("Where the pipeline stands"). */
  prompt: string;
}

export interface SponsorStageProps {
  sponsor: LivePerson;
  /** The sponsor is talking: a pulse ring around the avatar. */
  speaking: boolean;
  caption: LiveCaptionLine | null;
  /** The three bullet notes, written before you speak. */
  notes: [SponsorNote, SponsorNote, SponsorNote];
  onNoteChange: (index: number, value: string) => void;
  /** The pinned funnel snapshot. Bars are drawn against `scale` (the count that fills a bar). */
  funnel: { periodUnit: PeriodUnit; stages: SponsorFunnelStage[]; scale: number };
  /** The pinned KPI snapshot, in the storyline's currency. */
  kpi: { revenue: number; target: number };
  layout?: LiveLayout;
}

const pct = (n: number, scale: number) => `${Math.round((n / Math.max(1, scale)) * 100)}%`;

/**
 * Sponsor briefing workspace: the sponsor avatar with captions, your three points (filled first),
 * and the funnel and revenue snapshot pinned for reference.
 */
export function SponsorStage({ sponsor, speaking, caption, notes, onNoteChange, funnel, kpi, layout = 'desktop' }: SponsorStageProps) {
  const { t, number } = useI18n();
  const money = useMoney();
  return (
    <div className={`grid flex-1 content-start gap-5 ${layout === 'phone' ? 'grid-cols-1' : 'grid-cols-2'}`}>
      <div className="flex flex-col items-center gap-3.5">
        <div className="relative flex aspect-square w-full max-w-105 items-center justify-center rounded-28 bg-(image:--il-liveshell-sponsor-fill)">
          {sponsor.img
            ? <img src={sponsor.img} alt={sponsor.name} className="size-full rounded-28 object-cover object-top" />
            : <span aria-hidden="true" className="text-110 font-700 text-liveshell-on-signal opacity-85">{initialsOf(sponsor.name)}</span>}
          <span className="absolute top-3.5 left-4 text-12 font-700 text-liveshell-on-signal">{t('liveshell.sponsor.avatar')}</span>
          {speaking && <span aria-hidden="true" className="absolute -inset-1.5 animate-(--il-liveshell-roleplay-speaking-ring) rounded-32 border-2 border-solid border-liveshell-sponsor-ring" />}
        </div>
        {caption && <LiveCaption variant="panel" centered name={caption.name} text={caption.text} streaming={caption.streaming} ai={caption.aiGenerated} />}
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2.5 rounded-20 border border-line-default bg-surface-card p-4">
          <b>{t('liveshell.sponsor.notes.title')}</b>
          <span className="text-12 text-fg-secondary">{t('liveshell.sponsor.notes.lead', { name: shortNameOf(sponsor) })}</span>
          {notes.map((n, i) => (
            <input key={i} value={n.value} onChange={e => onNoteChange(i, e.target.value)} placeholder={n.prompt} aria-label={t('liveshell.sponsor.notes.aria', { n: i + 1 })}
              className="h-10 rounded-12 border border-solid border-line-strong bg-surface-raised px-3 py-0 text-14 text-fg-primary focus-visible:outline-2 focus-visible:outline-accent-secondary" />
          ))}
        </div>
        <div className="flex flex-col gap-2 rounded-20 border border-line-default bg-surface-card p-4">
          <div className="flex justify-between">
            <b>{t('liveshell.sponsor.funnel.title', { unit: funnel.periodUnit })}</b>
            <span className="text-12 text-fg-secondary">{t('liveshell.sponsor.funnel.pinned')}</span>
          </div>
          {funnel.stages.map(st => (
            <div key={st.key} className="grid grid-cols-(--il-liveshell-sponsor-funnel-columns) items-center gap-2 text-12">
              <span className="text-fg-secondary">{st.name}</span>
              <div className="relative h-2 rounded-4 bg-track">
                <div className="h-full rounded-4 bg-(image:--il-fill-meter)" style={{ width: pct(st.count, funnel.scale) }} />
                <div className="absolute -top-0.75 -bottom-0.75 w-0.5 bg-fg-primary" style={{ left: pct(st.ideal, funnel.scale) }} />
              </div>
              <b className="text-right">{t('liveshell.sponsor.funnel.value', { count: number(st.count), ideal: number(st.ideal) })}</b>
            </div>
          ))}
          <span className="text-12 text-fg-secondary">{t('liveshell.sponsor.funnel.foot', { revenue: money.format(kpi.revenue), target: money.format(kpi.target) })}</span>
        </div>
      </div>
    </div>
  );
}
