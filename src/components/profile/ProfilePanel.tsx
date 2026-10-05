import { useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import type { MoodKey, StyleKey } from '../../data/types';
import type { MetricKey } from '../../engine/contract';
import { useI18n, type I18n } from '../../i18n';
import { ActionTile, type ActionTileProps } from '../action/ActionTile';
import { SubPeriodUnitContext, type PeriodUnit, type SubPeriodUnit } from '../action/days';
import { LOW_BELOW } from '../metric/MetricBar';

/** Fact rows under the stats, in the order given. The style row always comes first, from `style`. */
export type ProfileFactKey = 'previous' | 'tenure' | 'experience' | 'skills' | 'remarks' | 'careerGoal' | 'relationships';

export interface ProfileFact {
  key: ProfileFactKey;
  /** Null while unknown. A null career goal reads "Not shared yet. It may come up in conversation." */
  value: string | null;
}

export interface ProfileStats {
  skill: number;
  morale: number;
  result: number;
  trust: number;
}

/** pos and neg colour the dot and the outcome line; neutral is quiet. */
export type ProfileTone = 'pos' | 'neg' | 'neutral';

export interface ProfileChange {
  metric: MetricKey;
  delta: number;
}

export interface ProfileTimelineEntry {
  id: string;
  /** When it happened, in the storyline's units: period 2, sub period 3 reads "Week 2, Day 3". */
  when: { period: number; sub: number };
  /** What happened, from the engine: "1:1 conversation", "Chat request went unanswered". */
  title: string;
  /** A line from a live interaction's transcript or draft. */
  quote?: string;
  tone: ProfileTone;
  /** How the person reacted, from the engine: "felt micromanaged" reads "Reaction: felt micromanaged". */
  reaction?: string;
  /** Metric changes. Empty reads "No change"; null shows no change line (only the reaction, if any). */
  changes: ProfileChange[] | null;
}

export type PromiseStatus = 'open' | 'kept' | 'broken';

export interface ProfilePromise {
  text: string;
  status: PromiseStatus;
}

export interface ProfilePanelProps {
  name: string;
  /** Job title, from the storyline. */
  title: string;
  img: string;
  mood: MoodKey;
  /** Away in training: grey portrait and "In training" in place of the mood. */
  away?: boolean;
  stats: ProfileStats;
  /** Style chosen for this period; null reads "Not chosen yet". */
  style: StyleKey | null;
  facts: ProfileFact[];
  /** A hidden concern once it has surfaced, as the engine words it. Never shown before. */
  shared: string | null;
  /** The storyline's units for the style row and the timeline ("Week 2, Day 3", "Month 2, Week 1"). */
  periodUnit: PeriodUnit;
  subPeriodUnit: SubPeriodUnit;
  /** Every action, event and outcome with this person, newest first. */
  timeline: ProfileTimelineEntry[];
  promises: ProfilePromise[];
  /** Every individual action for this person, as the Actions panel would show them. */
  actions: Array<Omit<ActionTileProps, 'layout'>>;
  onClose: () => void;
}

/** Icon glyph, not copy: the button is named from the catalog. */
const CLOSE_GLYPH = '✕';
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
export const STATS: MetricKey[] = ['skill', 'morale', 'result', 'trust'];
const DOT: Record<ProfileTone, string> = { pos: 'bg-status-gain', neg: 'bg-status-decline', neutral: 'bg-line-strong' };
const OUTCOME: Record<ProfileTone, string> = { pos: 'text-status-gain', neg: 'text-status-decline', neutral: 'text-fg-secondary' };
const PROMISE: Record<Exclude<PromiseStatus, 'open'>, string> = { kept: 'text-status-gain', broken: 'text-status-decline' };

/** Away members read grey; strained moods warm the backdrop, as on the member card. */
export function backdrop(mood: MoodKey, away: boolean): string {
  if (away) return 'bg-(image:--il-fill-portrait-away)';
  return mood === 'frustrated' || mood === 'concerned' ? 'bg-(image:--il-fill-portrait-warm)' : 'bg-(image:--il-fill-portrait-calm)';
}

/**
 * The words of a timeline entry: when ("Week 2, Day 3") and the outcome line ("Morale +8, Trust +6",
 * "Reaction: felt micromanaged. Morale −4", "No change"), or null when there is no outcome line.
 */
export function timelineText({ t, delta, locale }: I18n, entry: ProfileTimelineEntry, periodUnit: PeriodUnit, subPeriodUnit: SubPeriodUnit): { when: string; outcome: string | null } {
  const when = t('profile.timeline.when', {
    period: t('time.period', { unit: periodUnit, n: entry.when.period }),
    sub: t('time.subPeriod', { unit: subPeriodUnit, n: entry.when.sub })
  });
  const changes = entry.changes === null ? null
    : entry.changes.length === 0 ? t('profile.timeline.noChange')
    : new Intl.ListFormat(locale, { type: 'unit', style: 'short' }).format(entry.changes.map(c => t('profile.timeline.change', { metric: t('metric.name', { metric: c.metric }), delta: delta(c.delta) })));
  const outcome = entry.reaction
    ? (changes ? t('profile.timeline.reactionChanges', { reaction: entry.reaction, changes }) : t('profile.timeline.reaction', { reaction: entry.reaction }))
    : changes;
  return { when, outcome };
}

export function TimelineItem({ entry, periodUnit, subPeriodUnit }: { entry: ProfileTimelineEntry; periodUnit: PeriodUnit; subPeriodUnit: SubPeriodUnit }) {
  const i18n = useI18n();
  const { t } = i18n;
  const { when, outcome } = timelineText(i18n, entry, periodUnit, subPeriodUnit);
  return (
    <li className="grid grid-cols-(--il-profile-timeline-columns) gap-3">
      <div className="flex flex-col items-center" aria-hidden="true">
        <span className={`mt-1.25 size-2.5 rounded-round ${DOT[entry.tone]}`} />
        <span className="w-0.5 flex-1 bg-line-default" />
      </div>
      <div className="flex flex-col gap-1 pb-3">
        <span className="text-12 text-fg-secondary">{when}</span>
        <b className="text-14">{entry.title}</b>
        {entry.quote && <span className="rounded-10 bg-surface-raised px-2.5 py-2 text-13">{t('common.quote', { text: entry.quote })}</span>}
        {outcome && <span className={`text-12 font-700 ${OUTCOME[entry.tone]}`}>{outcome}</span>}
      </div>
    </li>
  );
}

export function PromiseLine({ promise }: { promise: ProfilePromise }) {
  const { t } = useI18n();
  const label = t('profile.promise.label', { status: promise.status });
  if (promise.status === 'open') {
    return <div className="rounded-12 border border-dashed border-line-strong px-3 py-2.5 text-13"><b>{label}</b> {promise.text}</div>;
  }
  return <div className="px-3 text-12 text-fg-secondary"><b className={PROMISE[promise.status]}>{label}</b> {promise.text}</div>;
}

/**
 * A member's profile over the board, in three columns: who they are (portrait, stats, style, facts,
 * a surfaced concern), your interactions with them (timeline with quotes and changes, promises) and
 * every action you can take with them. A non modal dialog: focus moves in on open and back to the
 * opener on close, and Escape inside it closes it.
 */
export function ProfilePanel(props: ProfilePanelProps) {
  const { name, title, img, mood, away = false, stats, style, facts, shared, periodUnit, subPeriodUnit, timeline, promises, actions, onClose } = props;
  const { t, number } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const interactionsId = useId();

  // Layout effect so the cleanup runs while the panel is still in the document and can tell
  // whether focus was inside it.
  useLayoutEffect(() => {
    const el = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      const inside = !active || active === document.body || (el?.contains(active) ?? false);
      if (inside && opener && opener !== document.body && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  const factRow = (label: string, value: string) => (
    <div key={label} className="grid grid-cols-(--il-profile-fact-columns) gap-2.5 text-13"><span className="text-fg-secondary">{label}</span><span>{value}</span></div>
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape closes the dialog
    <div ref={ref} role="dialog" aria-label={t('profile.aria', { name })} tabIndex={-1} onKeyDown={onKeyDown}
      className="absolute top-0 right-6 bottom-6 left-4 z-35 grid animate-(--il-profile-panel-enter) grid-cols-(--il-profile-panel-columns) overflow-hidden rounded-24 border border-line-strong bg-surface-material shadow-(--il-profile-panel-shadow) outline-none backdrop-blur-24">
      <div className="flex flex-col overflow-auto border-r border-line-default">
        <div className="flex items-center gap-4.5 px-5 pt-5.5 pb-1.5">
          <div className={`size-30 flex-none overflow-hidden rounded-round shadow-(--il-profile-portrait-ring) ${backdrop(mood, away)}`}>
            <img src={img} alt="" className={`size-full object-cover object-top mix-blend-multiply ${away ? 'grayscale' : ''}`} />
          </div>
          <div className="flex flex-col gap-0.5">
            <h2 className="m-0 text-24 font-700 tracking-(--il-profile-name-tracking)">{name}</h2>
            <span className="text-13 text-fg-secondary">{title}</span>
            <span className="text-13 font-700">{away ? t('member.mood.away') : t('member.mood', { mood })}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3.5 px-5 py-4.5">
          <div className="grid grid-cols-4 gap-2">
            {STATS.map(k => (
              <div key={k} className="flex flex-col rounded-12 bg-surface-raised p-2.5">
                <span className="text-12 text-fg-secondary">{t('metric.name', { metric: k })}</span>
                <b className={`text-20 ${stats[k] < LOW_BELOW ? 'text-status-attention' : 'text-fg-primary'}`}>{number(stats[k])}</b>
              </div>
            ))}
          </div>
          {shared && <div className="rounded-12 bg-accent-soft px-3 py-2.5 text-13"><b>{t('profile.shared')}</b> {shared}</div>}
          {factRow(t('profile.fact.label', { key: 'style', unit: periodUnit }), style ? t('style.name', { style }) : t('profile.fact.empty', { key: 'style' }))}
          {facts.map(f => factRow(t('profile.fact.label', { key: f.key, unit: periodUnit }), f.value ?? t('profile.fact.empty', { key: f.key })))}
        </div>
      </div>

      {/* A long timeline scrolls: the column takes focus so keyboards can scroll it (WCAG 2.1.1). */}
      <div role="region" aria-labelledby={interactionsId} tabIndex={0} className="flex flex-col gap-3 overflow-auto border-r border-line-default p-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-secondary">
        <h3 id={interactionsId} className="m-0 text-18 font-700">{t('profile.interactions.title')}</h3>
        {timeline.length === 0
          ? <p className="m-0 text-13 text-fg-secondary">{t('profile.interactions.empty', { name })}</p>
          : <ol className="m-0 contents list-none p-0">{timeline.map(e => <TimelineItem key={e.id} entry={e} periodUnit={periodUnit} subPeriodUnit={subPeriodUnit} />)}</ol>}
        {promises.map((p, i) => <PromiseLine key={i} promise={p} />)}
      </div>

      <div className="flex flex-col gap-2.5 overflow-auto p-5">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-18 font-700">{t('profile.actions.title')}</h3>
          <button type="button" onClick={onClose} aria-label={t('profile.close')}
            className={`size-8 cursor-pointer rounded-round border-0 bg-surface-raised p-0 text-fg-primary ${focus}`}>{CLOSE_GLYPH}</button>
        </div>
        <SubPeriodUnitContext.Provider value={subPeriodUnit}>
          {actions.map((a, i) => <ActionTile key={`${a.name}:${i}`} layout="compact" {...a} />)}
        </SubPeriodUnitContext.Provider>
      </div>
    </div>
  );
}
