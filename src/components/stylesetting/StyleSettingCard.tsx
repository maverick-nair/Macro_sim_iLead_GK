import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StyleKey } from '../../data/types';
import { useI18n } from '../../i18n';
import { StyleControl } from '../style/StyleControl';
import { LastPeriodTag } from './LastPeriodTag';
import { mark, rich } from './rich';
import { portraitBackdrop, statsHidden, styleChanged, type PeriodUnit, type StyleSettingMember } from './types';

/** How much of a saved reason the "Note: ..." link shows. */
const NOTE_PREVIEW = 28;

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

export interface StyleSettingCardProps {
  member: StyleSettingMember;
  periodUnit: PeriodUnit;
  onStyle: (style: StyleKey) => void;
  onRationale: (text: string) => void;
  /** Open style tooltip. Controlled when passed; otherwise the control keeps its own. */
  tooltip?: StyleKey | null;
  onTooltipChange?: (style: StyleKey | null) => void;
  /** Voice note seam: rendered beside the reason field when present, for a mic button later. */
  rationaleAddon?: ReactNode;
}

/** "Skill 35 · Morale 9 · Trust 30", numbers bold; or the hidden stats line. */
export function StatsLine({ member, short = false }: { member: StyleSettingMember; short?: boolean }) {
  const { t, number } = useI18n();
  if (statsHidden(member) || !member.stats) return <>{t('stylesetting.stats.hidden')}</>;
  const { skill, morale, trust } = member.stats;
  if (short) return <>{t('stylesetting.stats.short', { skill: number(skill), morale: number(morale), trust: number(trust) })}</>;
  const b = (v: number, k: string) => <b key={k} className="text-fg-primary">{number(v)}</b>;
  return <>{rich(t('stylesetting.stats', { skill: mark(0), morale: mark(1), trust: mark(2) }), [b(skill, 's'), b(morale, 'm'), b(trust, 't')])}</>;
}

/** The note under the control: the chosen style and what it means, or, while away, when it applies. */
export function useStyleNote(member: StyleSettingMember, periodUnit: PeriodUnit): { lead: string | null; text: string } {
  const { t } = useI18n();
  const away = t('stylesetting.away.note', { pronoun: member.pronoun ?? 'they', reason: member.awayReason ?? 'training' });
  if (member.style === null) return { lead: null, text: member.away ? away : t('stylesetting.unset', { unit: periodUnit }) };
  return { lead: t('stylesetting.choice', { style: t('style.name', { style: member.style }) }), text: member.away ? away : t('style.description', { style: member.style }) };
}

/**
 * One member on the style setting card view: portrait with name, stats (or the hidden stats line),
 * last period's tag, the D, G, P, E control, what the chosen style means, and an optional reason.
 * The border lights up when the style differs from last period's.
 */
export function StyleSettingCard({ member: m, periodUnit, onStyle, onRationale, tooltip, onTooltipChange, rationaleAddon }: StyleSettingCardProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const reopen = useRef(false);
  useEffect(() => {
    if (!editing && reopen.current) { reopen.current = false; opener.current?.focus(); }
  }, [editing]);
  const note = useStyleNote(m, periodUnit);
  const close = (refocus: boolean) => { reopen.current = refocus; setEditing(false); };

  return (
    <div role="group" aria-label={t('stylesetting.member.aria', { name: m.name, title: m.title, mood: t('member.mood', { mood: m.mood }) })}
      className={`flex flex-col rounded-20 border-2 bg-surface-card backdrop-blur-12 ${styleChanged(m) ? 'border-accent-secondary' : 'border-line-default'}`}>
      <div className={`relative h-30 overflow-hidden rounded-t-18 ${portraitBackdrop(m.away)}`}>
        <img src={m.img} alt="" className={`size-full object-cover object-(--il-stylesetting-portrait-position) mix-blend-multiply ${m.away ? 'grayscale' : ''}`} />
        <div className="absolute inset-0 bg-(image:--il-stylesetting-portrait-overlay)" />
        <div className="absolute bottom-2 left-3 flex flex-col text-member-on-portrait">
          <b className="text-15">{m.name}</b>
          <span className="text-12">{m.title}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-3 pt-2.5 pb-3">
        <span className="text-12 text-fg-secondary"><StatsLine member={m} /></span>
        <LastPeriodTag periodUnit={periodUnit} style={m.lastStyle} reaction={m.lastReaction} />
        <StyleControl size="md" value={m.style} onChange={onStyle} memberName={m.name} tooltip={tooltip} onTooltipChange={onTooltipChange} />
        <span className="min-h-8.5 text-12 text-pretty text-fg-secondary">
          {note.lead !== null && <><b className="text-fg-primary">{note.lead}</b> </>}{note.text}
        </span>
        {editing ? (
          <input
            // The field appears because the participant asked to add a reason.
            autoFocus // eslint-disable-line jsx-a11y/no-autofocus
            value={m.rationale}
            onChange={e => onRationale(e.target.value)}
            onBlur={() => close(false)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); close(true); } }}
            placeholder={t('stylesetting.rationale.placeholder')}
            aria-label={t('stylesetting.rationale.aria', { name: m.name })}
            className="h-8.5 rounded-10 border border-solid border-line-control bg-surface-raised px-2.5 py-0 text-13 text-fg-primary"
          />
        ) : (
          <button ref={opener} type="button" onClick={() => setEditing(true)}
            aria-label={m.rationale ? t('stylesetting.rationale.editAria', { name: m.name, text: m.rationale }) : t('stylesetting.rationale.addAria', { name: m.name })}
            className={`cursor-pointer self-start border-0 bg-transparent p-0 text-12 font-700 text-accent-secondary ${focus}`}>
            {m.rationale ? t('stylesetting.rationale.note', { text: m.rationale.slice(0, NOTE_PREVIEW) }) : t('stylesetting.rationale.add')}
          </button>
        )}
        {rationaleAddon}
      </div>
    </div>
  );
}
