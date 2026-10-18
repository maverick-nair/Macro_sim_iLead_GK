import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StyleKey } from '../../data/types';
import { useI18n } from '../../i18n';
import { StyleControl } from '../style/StyleControl';
import { styleOf, useLens } from '../style/lens';
import { LastPeriodTag } from './LastPeriodTag';
import { mark, rich } from './rich';
import { portraitBackdrop, statsHidden, type PeriodUnit, type StyleSettingMember } from './types';

/** How much of a saved reason the "Note: ..." link shows. */
const NOTE_PREVIEW = 28;

const focus = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

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
  const b = (v: number, k: string) => <b key={k} className="font-mono font-500 text-fg-primary">{number(v)}</b>;
  return <>{rich(t('stylesetting.stats', { skill: mark(0), morale: mark(1), trust: mark(2) }), [b(skill, 's'), b(morale, 'm'), b(trust, 't')])}</>;
}

/** The note under the control: the chosen style and what it means, or, while away, when it applies. */
export function useStyleNote(member: StyleSettingMember, periodUnit: PeriodUnit): { lead: string | null; text: string } {
  const { t } = useI18n();
  const lens = useLens();
  const away = t('stylesetting.away.note', { pronoun: member.pronoun ?? 'they', reason: member.awayReason ?? 'training' });
  if (member.style === null) return { lead: null, text: member.away ? away : t('stylesetting.unset', { unit: periodUnit }) };
  const s = styleOf(lens, member.style);
  return { lead: t('stylesetting.choice', { style: s.name }), text: member.away ? away : s.description };
}

const Plus = () => <svg className="size-3 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

/**
 * One member on the style setting screen, as the approved canvas draws it (D232): the photo across the column, the
 * name, their stage and mood, last period's style and how it landed when there was one, the stats once revealed, the
 * styles as named buttons two to a row, and an optional reason behind a dashed button. Away, a line says when the
 * style applies. Not boxed: the columns stand on the page.
 */
export function StyleSettingCard({ member: m, periodUnit, onStyle, onRationale, tooltip, onTooltipChange, rationaleAddon }: StyleSettingCardProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const reopen = useRef(false);
  useEffect(() => {
    if (!editing && reopen.current) { reopen.current = false; opener.current?.focus(); }
  }, [editing]);
  const close = (refocus: boolean) => { reopen.current = refocus; setEditing(false); };
  const mood = t('member.mood', { mood: m.mood });
  const note = useStyleNote(m, periodUnit);

  return (
    <div role="group" aria-label={t('stylesetting.member.aria', { name: m.name, title: m.title, mood })} data-member-id={m.id}
      className="flex min-w-0 flex-col gap-2">
      <div className={`relative h-32 overflow-hidden short:h-28 shorter:h-20 ${portraitBackdrop(m.away)}`}>
        <img src={m.img} alt="" className={`size-full object-cover object-(--il-stylesetting-portrait-position) mix-blend-multiply short:object-(--il-stylesetting-portrait-position-compact) ${m.away ? 'grayscale' : ''}`} />
      </div>
      <div className="flex min-w-0 flex-col">
        <b className="truncate text-14 font-600 text-large:whitespace-normal">{m.name}</b>
        <span className="text-12 text-fg-secondary">{t('stylesetting.member.line', { title: m.title, mood: m.away ? t('member.mood.away') : mood })}</span>
      </div>
      {m.lastStyle !== null && <LastPeriodTag periodUnit={periodUnit} style={m.lastStyle} reaction={m.lastReaction} />}
      {!statsHidden(m) && <span className="text-12 text-fg-secondary"><StatsLine member={m} /></span>}
      <div data-tour="style-control"><StyleControl variant="names" size="md" value={m.style} onChange={onStyle} memberName={m.name} tooltip={tooltip} onTooltipChange={onTooltipChange} /></div>
      {m.away && <span className="text-12 text-pretty text-fg-secondary">{note.text}</span>}
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
          className="h-10 min-w-0 rounded-3 border border-solid border-accent-default bg-surface-card px-2 py-0 text-13 text-fg-primary"
        />
      ) : (
        <button ref={opener} type="button" onClick={() => setEditing(true)} data-tour="style-reason"
          aria-label={m.rationale ? t('stylesetting.rationale.editAria', { name: m.name, text: m.rationale }) : t('stylesetting.rationale.addAria', { name: m.name })}
          className={`flex min-h-10 min-w-0 cursor-pointer items-center gap-1.5 rounded-3 border border-dashed border-line-strong bg-transparent px-2 text-start text-12 font-500 text-fg-secondary hover:text-fg-primary ${m.rationale ? 'border-solid' : ''} ${focus}`}>
          {!m.rationale && <Plus />}<span className="truncate">{m.rationale ? t('stylesetting.rationale.note', { text: m.rationale.slice(0, NOTE_PREVIEW) }) : t('stylesetting.rationale.add')}</span>
        </button>
      )}
      {rationaleAddon}
    </div>
  );
}
