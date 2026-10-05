import { useId, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { useReport } from './context';
import { TONE_TEXT } from './display';
import type { IntentCardData, PlanItemData } from './types';

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
  const { layout } = useReport();
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
      {alone && cards.length > 2 ? <div className={`grid gap-2.5 ${layout === 'phone' ? 'grid-cols-1' : 'grid-cols-2'}`}>{list}</div> : list}
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
}

/** "Your plan for next week": three numbered steps, built from the reflection when there is one. */
export function PlanSection({ items, reflection, checkIn, alone = true }: PlanSectionProps) {
  const { t, number } = useI18n();
  return (
    <Column title={t('report.plan.title')} alone={alone}>
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
      {checkIn && <span className="text-13 font-600">{checkIn}</span>}
    </Column>
  );
}

/** The design's pair: intent and action beside the plan, one column on a phone. */
export function PairSection({ children }: { children: ReactNode }) {
  const { layout } = useReport();
  return <section className={`grid gap-4 ${layout === 'phone' ? 'grid-cols-(--il-report-pair-columns-phone)' : 'grid-cols-(--il-report-pair-columns)'}`}>{children}</section>;
}
