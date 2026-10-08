import { useEffect, useId, useRef, useState } from 'react';
import type { Block, StakeholderView } from '../../engine/contract';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { useDays, type SubPeriodUnit } from '../action/days';
import { MetricTrack } from '../metric/MetricBar';
import { PANEL_FOCUS, PanelShell } from '../panels/PanelShell';
import { StakeholderFace } from './StakeholderBar';
import './messages';

export interface StakeholdersPanelProps {
  stakeholders: StakeholderView[];
  /** The stakeholder to open on, when one was picked on the board. */
  focus?: string | null;
  subPeriodUnit: SubPeriodUnit;
  busy: boolean;
  /** Read only: after the run, or outside the board. */
  locked?: boolean;
  /** Why an interaction cannot be taken now, worded in the storyline's units. */
  why: (b: Block) => string;
  /** Engages a stakeholder: a live interaction opens the conversation, a static one needs its option. Resolves true when the engine took it. */
  onEngage: (stakeholder: string, interaction: string, option?: string) => Promise<boolean>;
  /** Answers an open request: their message (a reply) or their meeting. */
  onAnswer: (stakeholder: string) => void;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null | undefined;
}

const card = 'flex flex-col gap-3 rounded-20 border border-line-default bg-surface-card px-4 py-3.5';
const pill = `flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill border border-solid border-line-strong bg-transparent px-3.5 py-0 text-13 font-700 text-fg-primary disabled:cursor-not-allowed disabled:opacity-60 ${PANEL_FOCUS}`;

/** One relationship measure: its name, a bar on the 0 to 100 scale, its value and its trend this period. */
function Measure({ measure, value, start }: { measure: 'trust' | 'satisfaction'; value: number; start: number }) {
  const { t, number } = useI18n();
  const dir = value > start ? 'up' : value < start ? 'down' : 'flat';
  return (
    <div role="img" aria-label={t('stakeholders.measureAria', { measure, value, dir })} className="grid grid-cols-(--il-metric-bar-columns) items-center gap-1.5 text-12">
      <span className="text-fg-secondary">{t('stakeholders.measure', { measure })}</span>
      <MetricTrack value={value} low={value < 30} />
      <b className={`text-end font-700 ${value < 30 ? 'text-status-attention' : ''}`}>
        {number(value)}{dir !== 'flat' && <span aria-hidden="true" className={`ms-0.5 text-11 ${dir === 'up' ? 'text-status-gain' : 'text-status-decline'}`}>{dir === 'up' ? '▲' : '▼'}</span>}
      </b>
    </div>
  );
}

/**
 * The stakeholders panel (D160 to D162): a card for each person outside the team with who they are, where the
 * relationship stands (trust and satisfaction, with this period's trend and what moved them), what they are
 * waiting on, and what you can do with them now: meet, present, negotiate or email, each with its days. A live
 * interaction opens the conversation screen; a static one asks for its option first. A side sheet like the other
 * in play panels (D89), loaded when first opened.
 */
export function StakeholdersPanel({ stakeholders, focus, subPeriodUnit, busy, locked, why, onEngage, onAnswer, onClose, returnFocus }: StakeholdersPanelProps) {
  const { t, delta } = useI18n();
  const amount = useDays(subPeriodUnit);
  const id = useId();
  /** The static interaction whose options are open, and the option picked. */
  const [open, setOpen] = useState<{ key: string; interaction: string } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const focused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`${id}${focus}`);
    // After the sheet has moved focus to its title, bring the picked stakeholder into view.
    const timer = setTimeout(() => el?.scrollIntoView({ block: 'start' }), 50);
    return () => clearTimeout(timer);
  }, [focus, id]);
  const engage = async (s: StakeholderView, x: StakeholderView['interactions'][number], option?: string) => {
    if (await onEngage(s.key, x.key, option)) { setOpen(null); setPicked(null); }
  };
  return (
    <PanelShell title={t('stakeholders.title')} intro={t('stakeholders.intro')} onClose={onClose} returnFocus={returnFocus}>
      {stakeholders.map(s => (
        <article key={s.key} id={`${id}${s.key}`} aria-labelledby={`${id}${s.key}h`} data-stakeholder={s.key} className={card} ref={el => { if (s.key === focus) focused.current = el; }}>
          <div className="flex items-start gap-3">
            <StakeholderFace name={s.name} img={s.img} level={s.level} size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h3 id={`${id}${s.key}h`} className="m-0 text-16 font-700">{s.name}</h3>
              <span className="text-13 text-fg-secondary">{t('stakeholders.role', { role: s.role, kind: s.kind })}</span>
              <span className="text-13 font-600">{t('stakeholders.level', { level: s.level })}</span>
            </div>
          </div>
          {s.about && <p className="m-0 text-13 text-pretty">{s.about}</p>}
          {s.concern && <p className="m-0 rounded-14 bg-surface-raised px-3 py-2 text-13 text-pretty"><b>{t('stakeholders.concern')}</b> {s.concern}</p>}
          <div className="flex flex-col gap-1.5">
            <Measure measure="trust" value={s.trust} start={s.start.trust} />
            <Measure measure="satisfaction" value={s.satisfaction} start={s.start.satisfaction} />
          </div>
          {s.causes.length > 0 && (
            <details className="text-13">
              <summary className={`cursor-pointer font-700 ${PANEL_FOCUS}`}>{t('stakeholders.causes')}</summary>
              <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                {s.causes.map((c, i) => <li key={i}>{c.text} <span className="text-fg-secondary">{t('stakeholders.moved', { trust: delta(c.trust), satisfaction: delta(c.satisfaction) })}</span></li>)}
              </ul>
            </details>
          )}
          {s.request && (
            <div data-request="" className="flex flex-wrap items-center gap-2 rounded-16 bg-status-attention-soft px-3 py-2 text-13">
              <span className="flex-1"><b>{t('stakeholders.asks', { kind: s.request.kind, name: s.name.split(' ')[0] })}</b> {s.request.title} <span className="text-fg-secondary">{t('stakeholders.due', { n: s.request.dueInSubPeriods, unit: subPeriodUnit })}</span></span>
              <Button variant="secondary" size="sm" disabled={busy || locked} onClick={() => onAnswer(s.key)}>{t('stakeholders.answer')}<span className="sr-only"> {s.name}</span></Button>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <b className="text-13">{t('stakeholders.actions', { name: s.name.split(' ')[0] })}</b>
            {s.engaged && <span className="text-12 text-fg-secondary">{t('stakeholders.engaged', { name: s.name.split(' ')[0] })}</span>}
            {s.interactions.length === 0 && <span className="text-13 text-fg-secondary">{t('stakeholders.none')}</span>}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {s.interactions.map(x => {
                const blocked = locked ? null : x.blocked;
                const isOpen = open?.key === s.key && open.interaction === x.key;
                const descId = `${id}${s.key}${x.key}d`;
                return (
                  <li key={x.key} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className={pill} disabled={busy || locked || !!blocked} aria-describedby={descId} aria-expanded={x.kind === 'static' ? isOpen : undefined}
                        onClick={() => { if (x.kind === 'static') { setOpen(isOpen ? null : { key: s.key, interaction: x.key }); setPicked(null); } else void engage(s, x); }}>
                        {x.label}<span className="font-400 text-fg-secondary">{t('stakeholders.cost', { cost: x.cost === 0 ? t('actions.costNothing') : amount(x.cost) })}</span>
                      </button>
                      <span className="text-12 text-fg-secondary">{t('stakeholders.type', { type: x.type, kind: x.kind })}</span>
                    </div>
                    <span id={descId} className="text-12 text-pretty text-fg-secondary">{blocked ? why(blocked) : x.goal ?? ''}</span>
                    {isOpen && x.options && (
                      <fieldset className="m-0 flex flex-col gap-2 rounded-16 border border-line-default p-3">
                        <legend className="px-1 text-13 font-700">{t('stakeholders.options')}</legend>
                        {x.options.map(o => (
                          <label key={o.key} className={`flex cursor-pointer items-start gap-2.5 rounded-14 border px-3 py-2 text-13 ${picked === o.key ? 'border-accent-secondary bg-accent-soft' : 'border-line-default'}`}>
                            <input type="radio" name={`${id}${s.key}${x.key}`} value={o.key} checked={picked === o.key} onChange={() => setPicked(o.key)} className={`mt-1 ${PANEL_FOCUS}`} />
                            <span className="flex flex-col gap-0.5"><b>{o.label}</b>{o.detail && <span className="text-12 text-fg-secondary">{o.detail}</span>}</span>
                          </label>
                        ))}
                        <div className="flex justify-end gap-2">
                          <Button variant="primary" size="sm" disabled={busy || !picked} onClick={() => { if (picked) void engage(s, x, picked); }}>{t('stakeholders.confirm')}</Button>
                        </div>
                      </fieldset>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </article>
      ))}
    </PanelShell>
  );
}

export default StakeholdersPanel;
