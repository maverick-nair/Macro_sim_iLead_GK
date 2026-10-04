import { useId } from 'react';
import { Button, NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { Heading, type HeadingLevel } from '../Heading';
import { ReasonChip, type ReasonChipProps } from '../reason/ReasonChip';
import { ReasonDetail, type ReasonDetailProps } from '../reason/ReasonDetail';

export interface OutcomePerson {
  id: string;
  /** Full name, for the portrait's alt text and the face buttons. */
  name: string;
  /** First name, for the reply and the mobile portrait. */
  shortName: string;
  img: string;
}

export type OutcomeChange = Pick<ReasonChipProps, 'name' | 'metric' | 'delta'>;

/**
 * How an interaction landed, from the engine. There is deliberately no rubric band field: the spec
 * forbids showing band names (Strong, Adequate and so on) to participants. Consequences go in
 * `changed` as plain sentences.
 */
/** One reason behind changes in the outcome. */
export type OutcomeWhy = Omit<ReasonDetailProps, 'layout'>;

export interface OutcomePanelProps {
  /** `band`: desktop, above the board. `card`: mobile, top of the list. */
  layout?: 'band' | 'card';
  person: OutcomePerson;
  /** What the outcome came from, after the eyebrow on desktop: "1:1 with Kent". */
  context?: string;
  headline: string;
  /** The NPC's reply, in their voice. */
  reply: string;
  /** Replays the reply in the NPC's voice. Leave it out when there is no voice to replay. */
  onReplay?: () => void;
  /** The reasons behind the changes: one, or one per distinct reason (rule 5: every change shows its reason). */
  why: OutcomeWhy | OutcomeWhy[];
  whyOpen: boolean;
  onToggleWhy: () => void;
  /** Everyone affected; tap a face to read their reaction. Desktop only. */
  affected: OutcomePerson[];
  revealed: string | null;
  reaction?: { name: string; text: string };
  onReveal: (id: string) => void;
  changes: OutcomeChange[];
  showNumbers: boolean;
  onToggleNumbers: () => void;
  /** "Jack noticed" style line when a bystander reacted. */
  ripple: string;
  /** Up to 2 lines of consequence; more are dropped. */
  changed: string[];
  onDismiss: () => void;
  /** Opens the full entry in History. Leave it out when there is nowhere to open it. */
  onOpenHistory?: () => void;
  /**
   * Level of the headline heading, so the page sets the outline. Defaults to 3; on the board, where
   * the band sits directly under the page heading, pass 2.
   */
  headingLevel?: HeadingLevel;
}

const PlayIcon = () => <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
/** Icon glyphs, not copy: the buttons are named from the catalog. */
const CLOSE_GLYPH = '✕';
/** U+FE0E keeps the triangle a text glyph, never an emoji. */
const PLAY_GLYPH = '▶\uFE0E';

const eyebrow = 'text-12 font-700 tracking-(--il-outcome-eyebrow-tracking) text-fg-secondary uppercase';
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const link = `cursor-pointer border-0 bg-transparent px-1.5 py-0.25 text-13 ${focus}`;

/** The outcome panel: headline, the reply with replay, who it affected, reason chips, ripple and what changed. */
export function OutcomePanel(p: OutcomePanelProps) {
  const { t } = useI18n();
  const whyId = useId();
  const layout = p.layout ?? 'band';
  const quote = t('common.quote', { text: p.reply });
  const changed = p.changed.slice(0, 2);
  const chips = p.changes.map((c, i) => <ReasonChip key={i} {...c} showNumbers={p.showNumbers} onToggle={p.onToggleNumbers} size={layout === 'card' ? 'md' : 'sm'} />);
  const whyLabel = t('outcome.why', { open: String(p.whyOpen) });
  const whys = Array.isArray(p.why) ? p.why : [p.why];
  const details = (layout?: 'stack') => whys.map((w, i) => <ReasonDetail key={i} {...w} layout={layout} />);

  if (layout === 'card') {
    return (
      <section aria-label={t('outcome.region')} className="flex animate-(--il-outcome-card-enter) flex-col gap-3 rounded-22 border border-line-strong bg-surface-material p-4.5">
        <div className="flex items-center gap-3">
          <div className="size-16 flex-none overflow-hidden rounded-round bg-portrait-calm shadow-(--il-outcome-portrait-ring)">
            <img src={p.person.img} alt={p.person.shortName} className="size-full object-cover object-top mix-blend-multiply" />
          </div>
          <div className="flex flex-col">
            <span className={eyebrow}>{t('outcome.eyebrow')}</span>
            <Heading level={p.headingLevel ?? 3} className="m-0 text-18 font-700 leading-(--il-outcome-headline-leading)">{p.headline}</Heading>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-14 bg-surface-raised p-3">
          {p.onReplay && (
            <button type="button" onClick={p.onReplay} aria-label={t('outcome.replayShort')} className={`size-8 flex-none cursor-pointer rounded-round border-0 bg-transparent bg-brand p-0 text-brand-deep-space ${focus}`}>
              <span aria-hidden="true">{PLAY_GLYPH}</span>
            </button>
          )}
          <span className="text-14">{quote}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">{chips}</div>
        <span className="text-13 text-fg-secondary">{p.ripple}</span>
        {changed.map((c, i) => <span key={i} className="text-14">{c}</span>)}
        {p.whyOpen && <div id={whyId} className="contents">{details('stack')}</div>}
        <div className="flex gap-2">
          <NoWrapButton variant="secondary" size="lg" onClick={p.onToggleWhy}>{whyLabel}</NoWrapButton>
          <Button variant="primary" size="lg" onClick={p.onDismiss}>{t('outcome.back')}</Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={t('outcome.region')} className="mx-6 mt-0 mb-3.5 grid animate-(--il-outcome-band-enter) grid-cols-(--il-outcome-band-columns) items-start gap-6 rounded-22 border border-line-strong bg-surface-material px-5 py-4 shadow-(--il-outcome-band-shadow)">
      <div className="size-21 overflow-hidden rounded-round bg-portrait-calm shadow-(--il-outcome-portrait-ring)">
        <img src={p.person.img} alt={p.person.name} className="size-full object-cover object-top mix-blend-multiply" />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <span className={eyebrow}>{p.context ? t('outcome.eyebrowContext', { context: p.context }) : t('outcome.eyebrow')}</span>
        <Heading level={p.headingLevel ?? 3} className="m-0 text-20 font-700 tracking-(--il-outcome-headline-tracking)">{p.headline}</Heading>
        <div className="flex items-start gap-2.5">
          {p.onReplay && (
            <button type="button" onClick={p.onReplay} aria-label={t('outcome.replay', { name: p.person.shortName })}
              className={`flex size-8 flex-none cursor-pointer items-center justify-center rounded-round border-0 bg-transparent bg-brand p-0 text-brand-deep-space ${focus}`}><PlayIcon /></button>
          )}
          <span className="text-14 text-pretty">{quote}</span>
        </div>
        {p.whyOpen && <div id={whyId} className="contents">{details()}</div>}
      </div>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex gap-2">
          {p.affected.map(a => (
            <button key={a.id} type="button" onClick={() => p.onReveal(a.id)} aria-label={t('outcome.face', { name: a.name })} aria-pressed={p.revealed === a.id}
              className={`relative size-11 cursor-pointer overflow-hidden rounded-round border-2 border-solid bg-transparent bg-portrait-calm p-0 ${p.revealed === a.id ? 'border-accent-secondary' : 'border-line-strong'} ${focus}`}>
              <img src={a.img} alt="" className="size-full object-cover object-top mix-blend-multiply" />
            </button>
          ))}
        </div>
        {p.reaction && <span aria-live="polite" className="rounded-12 bg-surface-raised px-2.5 py-2 text-13"><b>{t('outcome.reaction', { name: p.reaction.name })}</b> {p.reaction.text}</span>}
        <div className="flex flex-wrap gap-1.5">{chips}</div>
        <span className="text-13 text-fg-secondary">{p.ripple}</span>
        {changed.map((c, i) => <span key={i} className="text-13">{c}</span>)}
      </div>
      <div className="flex flex-col items-end gap-2">
        <button type="button" onClick={p.onDismiss} aria-label={t('outcome.dismiss')} className={`size-8 cursor-pointer rounded-round border-0 bg-surface-raised p-0 text-fg-primary ${focus}`}>
          <span aria-hidden="true">{CLOSE_GLYPH}</span>
        </button>
        <button type="button" onClick={p.onToggleWhy} aria-expanded={p.whyOpen} aria-controls={p.whyOpen ? whyId : undefined} className={`${link} font-700 text-accent-secondary`}>{whyLabel}</button>
        {p.onOpenHistory && <button type="button" onClick={p.onOpenHistory} className={`${link} font-600 text-fg-secondary`}>{t('outcome.history')}</button>}
      </div>
    </section>
  );
}
