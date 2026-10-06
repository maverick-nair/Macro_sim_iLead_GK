import { useId, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { TONE_TEXT } from './display';
import { usePurpose } from './context';
import type { IntentCardData, PlanExtras, PlanItemData } from './types';
import './messages';

const CARD = 'flex flex-col gap-1 rounded-16 border border-line-default px-3.5 py-3 text-13';

/** A column of the report with its own h2. Stands alone as a section, or sits in a pair as a plain column. */
function Column({ title, alone, children }: { title: string; alone: boolean; children: ReactNode }) {
  const id = useId();
  const Tag = alone ? 'section' : 'div';
  return (
    <Tag aria-labelledby={alone ? `${id}h` : undefined} className="flex flex-col gap-2.5">
      <h2 id={`${id}h`} className="m-0 text-20 font-700">{title}</h2>
      {children}
    </Tag>
  );
}

export interface IntentSectionProps {
  cards: IntentCardData[];
  /** True when it stands alone (the engine report); false inside the design's pair with the plan. */
  alone?: boolean;
}

/** "Intent and action": what the participant said they would do, what they did, and whether the two met. */
export function IntentSection({ cards, alone = true }: IntentSectionProps) {
  const { t } = useI18n();
  const list = cards.map(c => (
    <div key={c.key} className={CARD}>
      {c.name && <b className="text-14">{c.name}</b>}
      {c.said && (
        <span>
          <b>{t('report.intent.said')}</b> {t('report.quote', { text: c.said })}
        </span>
      )}
      <span>
        <b>{t('report.intent.did')}</b> {c.did}
      </span>
      {c.quote && (
        <span className="text-fg-secondary">
          {t('report.quote', { text: c.quote.text })}{' '}<span className="whitespace-nowrap">{c.quote.when}</span>
        </span>
      )}
      <span className={`font-700 ${TONE_TEXT[c.tone]}`}>{c.verdict}</span>
      {c.cost && <span className="text-12 text-fg-secondary">{c.cost}</span>}
    </div>
  ));
  return (
    <Column title={t('report.intent.title')} alone={alone}>
      {alone && cards.length > 2 ? <div className="grid gap-2.5 grid-cols-2">{list}</div> : list}
    </Column>
  );
}

export interface PlanSectionProps {
  items: PlanItemData[];
  /** The participant's first reflection answer, when there is one. */
  reflection: string | null;
  /** "Check in on 19 October 2026", engine only. */
  checkIn?: string | null;
  alone?: boolean;
  /** Report 3.0: the 90 day path and check ins (development), or the development needs (assessment). */
  extras?: PlanExtras;
}

/**
 * "Your plan for next week": three numbered steps, built from the reflection when there is one, then the
 * 90 day path and the check ins. In an assessment report, "Development needs": the skills below the bar,
 * listed neutrally against it.
 */
export function PlanSection({ items, reflection, checkIn, alone = true, extras }: PlanSectionProps) {
  const { t, number } = useI18n();
  const purpose = usePurpose();
  if (purpose === 'assessment') {
    return (
      <Column title={t('report.plan.title', { purpose })} alone={alone}>
        {!extras?.needs?.length && <p className="m-0 text-14 text-fg-secondary">{t('report.plan.noNeeds')}</p>}
        {extras?.needs?.map(n => (
          <div key={n.key} className={CARD}>
            <b className="text-14">{n.name}</b>
            <span className="text-pretty">{n.text}</span>
            {n.anchor && <span className="text-fg-secondary text-pretty">{n.anchor}</span>}
          </div>
        ))}
      </Column>
    );
  }
  return (
    <Column title={t('report.plan.title', { purpose })} alone={alone}>
      {items.map((p, i) => (
        <div key={p.key} className="grid grid-cols-(--il-report-plan-columns) gap-2.5 rounded-16 border border-line-default px-3.5 py-3 text-14">
          <b className="flex min-h-7 min-w-7 self-start items-center justify-center rounded-round px-1 bg-(image:--il-fill-brand) text-13 text-brand-deep-space">{number(i + 1)}</b>
          {p.skill ? (
            <div className="flex flex-col gap-1">
              <b>{p.skill}</b>
              <span className="text-pretty">{p.text}</span>
              {p.onTheJob && <span className="text-13 text-pretty"><b>{t('report.plan.onTheJob')}</b> {p.onTheJob}</span>}
              {p.enoughEvidence === false && <span className="text-12 text-fg-secondary">{t('report.plan.noEvidence')}</span>}
            </div>
          ) : <span className="text-pretty">{p.text}</span>}
        </div>
      ))}
      {reflection && <span className="text-12 text-fg-secondary">{t('report.plan.reflection', { text: reflection })}</span>}
      {checkIn && !extras?.checkIns?.length && <span className="text-13 font-600">{checkIn}</span>}
      {extras?.path && (
        <>
          <h3 className="m-0 mt-2 text-15 font-700">{t('report.plan.pathTitle')}</h3>
          <ol className="m-0 grid list-none gap-2.5 p-0 grid-cols-(--il-report-tiles-columns)">
            {[extras.path.day30, extras.path.day60, extras.path.day90].map(step => <li key={step} className={`${CARD} text-pretty`}>{step}</li>)}
          </ol>
        </>
      )}
      {extras?.checkIns && extras.checkIns.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-15 font-700">{t('report.plan.checkIns')}</h3>
          <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-13 font-600">
            {extras.checkIns.map(d => <li key={d}>{d}</li>)}
          </ul>
        </div>
      )}
    </Column>
  );
}

/** The design's pair: intent and action beside the plan. */
export function PairSection({ children }: { children: ReactNode }) {
  return <section className="grid gap-4 grid-cols-(--il-report-pair-columns)">{children}</section>;
}
