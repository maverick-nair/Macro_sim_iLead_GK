import * as Dialog from '@radix-ui/react-dialog';
import { useState, type CSSProperties } from 'react';
import type { MoodKey } from '../../data/types';
import type { MetricKey } from '../../engine/contract';
import { useI18n } from '../../i18n';
import type { PeriodUnit } from '../action/days';
import { LOW_BELOW } from '../metric/MetricBar';
import { backdrop } from '../member/MemberCard';
import { STATS } from '../profile/ProfilePanel';
import type { Performance } from './performance';

export interface FunnelPerson {
  id: string;
  name: string;
  img: string;
  mood: MoodKey;
  away: boolean;
  stats: Record<MetricKey, number> | null;
  performance: Performance | null;
  /** This period's style by name, or null before one is set. */
  style: string | null;
}

export interface FunnelStage {
  key: string;
  name: string;
  about?: string | null;
  suits?: string | null;
  bottleneck: boolean;
  /** This period's output against its ideal (the engine's throughput, D216). */
  output: { n: number; ideal: number };
  /** People in the stage now, and the storyline's ideal headcount. */
  headcount: { n: number; ideal: number };
  people: FunnelPerson[];
}

export interface FunnelDialogProps {
  stages: FunnelStage[];
  periodUnit: PeriodUnit;
  /** "8 week target $60K of $240K", as the status band says it. */
  money: string;
  onClose: () => void;
  /** Selects someone on the board and closes the funnel, so their actions are one step away. */
  onPerson: (id: string) => void;
}

const CLOSE_GLYPH = '✕';
const focus = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const pct = (n: number) => `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;

/** Each band is narrower than the one above, a trapezoid cut by clip-path, darker the deeper the stage. */
function bandStyle(i: number, count: number): CSSProperties {
  const top = 100 - (i * 44) / count, bottom = 100 - ((i + 1) * 44) / count;
  const inset = ((top - bottom) / 2 / top) * 100;
  return {
    width: `${top}%`,
    clipPath: `polygon(0 0, 100% 0, ${100 - inset}% 100%, ${inset}% 100%)`,
    // The token mixes the accent in by this share: deeper down the funnel, deeper the band.
    ['--il-funnel-mix' as string]: `${Math.round(16 + (i * 26) / Math.max(1, count - 1))}%`
  } as CSSProperties;
}

/**
 * The team's pipeline as a funnel, opened from the board (D242) instead of standing over the team: one band per stage,
 * narrowing as the work moves down, each with this period's output against its ideal as a fill, and the bottleneck
 * marked in words. Beside it every stage at once: who works in it, each person's four stats and how they are
 * delivering, and the stage's headcount against its ideal. Choosing a band shows what the stage does and which skills
 * suit it; choosing a person selects them on the board. Everything is the engine's number; nothing scrolls on a laptop.
 */
export function FunnelDialog({ stages, periodUnit, money, onClose, onPerson }: FunnelDialogProps) {
  const { t, number } = useI18n();
  const [chosen, setChosen] = useState<string>(stages.find(s => s.bottleneck)?.key ?? stages[0]?.key ?? '');
  const open = stages.find(s => s.key === chosen);
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Overlay className="fixed inset-0 z-46 flex items-center justify-center bg-surface-scrim p-6 short:p-3">
        <Dialog.Content aria-describedby={undefined} aria-modal="true" data-funnel=""
          className="flex max-h-full w-full max-w-(--il-funnel-max-width) animate-(--il-mail-enter) flex-col overflow-hidden rounded-4 border border-line-strong bg-surface-page text-fg-primary shadow-(--il-mail-shadow) outline-0">
          <div className="flex items-center gap-4 border-b border-line-strong bg-surface-card px-6 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <Dialog.Title className="m-0 font-display text-28 leading-tight font-400">{t('funnel.title')}</Dialog.Title>
              <span className="text-13 text-fg-body">{t('desk.funnel.note', { unit: periodUnit })}</span>
            </span>
            <span className="text-14 text-fg-body">{money}</span>
            <Dialog.Close asChild>
              <button type="button" aria-label={t('funnel.close')} className={`size-11 flex-none cursor-pointer rounded-4 border border-line-strong bg-surface-card p-0 text-fg-primary ${focus}`}>{CLOSE_GLYPH}</button>
            </Dialog.Close>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-(--il-funnel-columns) gap-6 overflow-auto p-6 short:gap-4 short:p-4">
            {/* The funnel: one band a stage, a radio group so arrow keys move between them. */}
            <div className="flex min-w-0 flex-col gap-3">
              <div role="radiogroup" aria-label={t('funnel.stages')} className="flex flex-col items-center gap-1">
                {stages.map((s, i) => {
                  const share = s.output.ideal > 0 ? s.output.n / s.output.ideal : 0;
                  const on = s.key === chosen;
                  return (
                    <button key={s.key} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-stage={s.key} data-bottleneck={s.bottleneck || undefined}
                      aria-label={t('desk.stage.outputAria', { stage: s.name, n: Math.round(s.output.n), ideal: Math.round(s.output.ideal), unit: periodUnit, bottleneck: s.bottleneck ? 'yes' : 'no', people: s.headcount.n, ideal2: s.headcount.ideal })}
                      onClick={() => setChosen(s.key)}
                      onKeyDown={e => {
                        const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
                        if (!step) return;
                        e.preventDefault();
                        const next = stages[(i + step + stages.length) % stages.length];
                        setChosen(next.key);
                        (e.currentTarget.parentElement?.querySelector(`[data-stage="${next.key}"]`) as HTMLElement | null)?.focus();
                      }}
                      style={{ width: bandStyle(i, stages.length).width }}
                      // The button is a plain box, so its focus ring shows; the trapezoid is drawn inside it.
                      className={`relative flex min-h-(--il-funnel-band-height) cursor-pointer border-0 bg-transparent p-0 short:min-h-(--il-funnel-band-height-short) ${focus}`}>
                      <span aria-hidden="true" style={bandStyle(i, stages.length)}
                        className={`relative flex flex-1 ${on ? 'bg-accent-default' : 'bg-(--il-funnel-band)'} flex-col items-center justify-center gap-0.5 overflow-hidden px-8 py-1.5 text-center ${on ? 'text-fg-on-accent' : 'text-fg-primary'}`}>
                        {/* Output against the ideal fills the band from the left. */}
                        <span className={`absolute inset-y-0 start-0 ${on ? 'bg-(--il-funnel-fill-on)' : s.bottleneck ? 'bg-status-attention-soft' : 'bg-(--il-funnel-fill)'}`} style={{ width: pct(share) }} />
                        <b className={`relative text-15 font-600 ${s.bottleneck && !on ? 'text-status-attention' : ''}`}>{s.bottleneck && '! '}{s.name}</b>
                        <span className="relative font-mono text-13">{t('desk.stage.output', { n: number(Math.round(s.output.n)), ideal: number(Math.round(s.output.ideal)) })}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {open && (
                <div aria-live="polite" className="flex flex-col gap-1.5 rounded-4 border border-line-strong bg-surface-card p-3.5 text-13">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="text-15">{open.name}</b>
                    {open.bottleneck && <b className="text-12 text-status-attention">{t('team.stage.bottleneck', { unit: periodUnit })}</b>}
                  </span>
                  {open.about && <span>{open.about}</span>}
                  {open.suits && <span className="text-fg-body"><b className="text-fg-primary">{t('team.stage.suits')}</b> {open.suits}</span>}
                  <span className="text-fg-body">{t('funnel.headcount', { n: open.headcount.n, ideal: open.headcount.ideal })}</span>
                </div>
              )}
            </div>

            {/* Every stage and its people at once. */}
            <table className="w-full border-collapse self-start text-13">
              <caption className="sr-only">{t('funnel.table')}</caption>
              <thead>
                <tr className="border-b border-fg-primary text-start text-12 text-fg-body">
                  <th scope="col" className="py-2 pe-3 text-start font-600">{t('funnel.col.stage')}</th>
                  <th scope="col" className="py-2 pe-3 text-start font-600">{t('funnel.col.output')}</th>
                  <th scope="col" className="py-2 text-start font-600">{t('funnel.col.people')}</th>
                </tr>
              </thead>
              <tbody>
                {stages.map(s => (
                  <tr key={s.key} data-stage-row={s.key} className={`border-b border-line-default align-top ${s.key === chosen ? 'bg-accent-soft' : ''}`}>
                    <th scope="row" className="py-2.5 pe-3 text-start">
                      <span className={`block font-600 ${s.bottleneck ? 'text-status-attention' : ''}`}>{s.name}</span>
                      {s.bottleneck && <span className="text-12 font-600 text-status-attention">{t('desk.stage.bottleneck')}</span>}
                      <span className="block text-12 font-400 text-fg-body">{t('funnel.headcount', { n: s.headcount.n, ideal: s.headcount.ideal })}</span>
                    </th>
                    <td className="w-32 py-2.5 pe-3">
                      <span className="font-mono text-14">{number(Math.round(s.output.n))}</span> <span className="text-12 text-fg-body">{t('desk.stage.of', { ideal: number(Math.round(s.output.ideal)) })}</span>
                      <span aria-hidden="true" className="mt-1 block h-1.25 bg-track"><span className={`block h-full ${s.bottleneck ? 'bg-status-attention' : 'bg-accent-default'}`} style={{ width: pct(s.output.ideal > 0 ? s.output.n / s.output.ideal : 0) }} /></span>
                    </td>
                    <td className="py-2">
                      {s.people.length === 0 ? <span className="text-fg-secondary">{t('funnel.empty')}</span> : (
                        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                          {s.people.map(m => (
                            <li key={m.id}>
                              <button type="button" onClick={() => onPerson(m.id)}
                                aria-label={[t('funnel.person', { name: m.name }), m.stats ? t('funnel.stats', { ...m.stats }) : '', m.performance?.text ?? ''].filter(Boolean).join('. ')}
                                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-4 border border-line-strong bg-surface-card py-1 ps-1 pe-2.5 text-start hover:border-line-control ${focus}`}>
                                <span className={`size-8 flex-none overflow-hidden rounded-round ${backdrop(m.mood, m.away)}`}><img src={m.img} alt="" className={`size-full object-cover object-top mix-blend-multiply ${m.away ? 'grayscale' : ''}`} /></span>
                                <span aria-hidden="true" className="flex min-w-0 flex-col">
                                  <span className="flex items-baseline gap-2"><b className="text-13">{m.name.split(' ')[0]}</b>{m.performance && <span className={`text-11 ${m.performance.dir === 'up' ? 'text-status-gain' : m.performance.dir === 'down' ? 'text-status-decline' : 'text-fg-secondary'}`}>{m.performance.band}{m.performance.dir !== 'flat' && ` ${m.performance.move}`}</span>}</span>
                                  {m.stats && (
                                    <span className="flex gap-2 font-mono text-11 text-fg-body">
                                      {STATS.map(k => <span key={k}>{t('funnel.stat', { metric: k })}<b className={`ms-0.5 font-500 ${m.stats![k] < LOW_BELOW ? 'text-status-attention' : 'text-fg-primary'}`}>{number(m.stats![k])}</b></span>)}
                                    </span>
                                  )}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}

const FunnelIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h18l-7 8v6l-4 2v-8z" /></svg>
);

/** The button that opens the funnel, beside "Your team" on the board (D242). */
export function FunnelButton({ onOpen, bottleneck }: { onOpen: () => void; bottleneck: string | null }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onOpen} aria-haspopup="dialog" data-tour="funnel"
      className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-4 border border-solid border-line-strong bg-surface-card px-3 text-13 font-600 whitespace-nowrap text-fg-primary hover:border-line-control ${focus}`}>
      <FunnelIcon />{t('funnel.open')}
      {bottleneck && <span className="font-500 text-status-attention">{t('funnel.openBottleneck', { stage: bottleneck })}</span>}
    </button>
  );
}
