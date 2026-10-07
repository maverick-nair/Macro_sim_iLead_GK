import { useId } from 'react';
import type { StyleKey } from '../../data/types';
import { useI18n } from '../../i18n';
import { StyleRadio } from '../style/StyleControl';
import { useLens, useStyleName } from '../style/lens';
import { StatsLine } from './StyleSettingCard';
import { portraitBackdrop, type PeriodUnit, type StyleSettingMember } from './types';

/** A round portrait for the list and the summary. */
export function StyleAvatar({ img, away, size }: { img: string; away: boolean; size: 'sm' | 'md' }) {
  return (
    <span aria-hidden="true" className={`flex-none overflow-hidden rounded-round ${size === 'md' ? 'size-10' : 'size-8'} ${portraitBackdrop(away)}`}>
      <img src={img} alt="" className="size-full object-cover object-top mix-blend-multiply" />
    </span>
  );
}

const grid = 'grid grid-cols-(--il-stylesetting-list-columns) gap-3';
/** The list's columns for a lens with other than four styles: one narrower radio column per style. */
const columns = (n: number) => (n === 4 ? undefined
  : { gridTemplateColumns: `var(--il-stylesetting-list-lead-lens) repeat(${n}, var(--il-stylesetting-list-radio-lens)) var(--il-stylesetting-list-reason-lens)` });

export interface StyleSettingRowProps {
  member: StyleSettingMember;
  periodUnit: PeriodUnit;
  /** Shared prefix for radio names, unique per list. */
  radioPrefix: string;
  onStyle: (style: StyleKey) => void;
}

/**
 * One member in the list view: portrait, name and stage, stats, last period's style and reaction,
 * one radio per lens style as one radio group (one tab stop, arrow keys move and pick), and the reason.
 */
export function StyleSettingRow({ member: m, periodUnit, radioPrefix, onStyle }: StyleSettingRowProps) {
  const { t } = useI18n();
  const lens = useLens();
  const styleName = useStyleName();
  const pos = m.lastReaction === 'pos';
  return (
    <div role="row" style={columns(lens.styles.length)} className={`${grid} items-center border-b border-line-default px-4.5 py-2.5`}>
      <div role="rowheader" className="flex items-center gap-2.5">
        <StyleAvatar img={m.img} away={m.away} size="md" />
        <span className="flex flex-col">
          <b className="text-14">{m.name}</b>
          <span className="text-12 text-fg-secondary">{m.title}</span>
        </span>
        {m.away && <span className="sr-only">{t('stylesetting.away.note', { pronoun: m.pronoun ?? 'they', reason: m.awayReason ?? 'training' })}</span>}
      </div>
      <span role="cell" className="text-13"><StatsLine member={m} short /></span>
      <span role="cell" className="text-13">
        {m.lastStyle === null ? t('stylesetting.last.none', { unit: periodUnit }) : m.lastReaction === null ? styleName(m.lastStyle) : (
          <><span aria-hidden="true" className={pos ? 'text-status-gain' : 'text-status-decline'}>{t('stylesetting.reaction.arrow', { reaction: m.lastReaction })}</span> {t('stylesetting.last.list', { style: styleName(m.lastStyle), reaction: t('stylesetting.reaction', { reaction: m.lastReaction }) })}</>
        )}
      </span>
      {/* No boxes of their own: the radios stay grid items under their column headers. */}
      <div role="cell" aria-colspan={lens.styles.length} className="contents">
        <div role="radiogroup" aria-label={t('style.group.aria', { name: m.name })} className="contents">
          {lens.styles.map(({ key: k }) => <StyleRadio key={k} style={k} memberName={m.name} name={`${radioPrefix}${m.id}`} checked={m.style === k} onSelect={onStyle} />)}
        </div>
      </div>
      <span role="cell" className="text-13 text-fg-secondary">{m.rationale || t('stylesetting.rationale.none')}</span>
    </div>
  );
}

export interface StyleSettingListProps {
  members: StyleSettingMember[];
  periodUnit: PeriodUnit;
  onStyle: (id: string, style: StyleKey) => void;
}

/** The list view: a table with one row per member, the fastest path for keyboards and screen readers. */
export function StyleSettingList({ members, periodUnit, onStyle }: StyleSettingListProps) {
  const { t } = useI18n();
  const lens = useLens();
  const prefix = useId() + 'style-';
  return (
    <div role="table" aria-label={t('stylesetting.list.aria')} className="overflow-hidden rounded-22 border border-line-default bg-surface-card backdrop-blur-12">
      <div role="row" style={columns(lens.styles.length)} className={`${grid} border-b border-line-default px-4.5 py-3 text-12 font-700 tracking-(--il-stylesetting-list-header-tracking) text-fg-secondary uppercase`}>
        <span role="columnheader">{t('stylesetting.list.member')}</span>
        <span role="columnheader">{t('stylesetting.list.stats')}</span>
        <span role="columnheader">{t('stylesetting.list.last', { unit: periodUnit })}</span>
        {/* Five styles head their columns with the letter (the definitions above name them); screen readers hear the name. */}
        {lens.styles.map(s => (lens.styles.length > 4
          ? <span key={s.key} role="columnheader" className="text-center"><span aria-hidden="true">{s.letter}</span><span className="sr-only">{s.name}</span></span>
          : <span key={s.key} role="columnheader" className="text-center">{s.name}</span>))}
        <span role="columnheader">{t('stylesetting.list.reason')}</span>
      </div>
      {members.map(m => <StyleSettingRow key={m.id} member={m} periodUnit={periodUnit} radioPrefix={prefix} onStyle={k => onStyle(m.id, k)} />)}
    </div>
  );
}
