import { useI18n } from '../../i18n';

export interface ReasonDetailProps {
  cause: string;
  rule: string;
  /** The participant's words the judgement rests on. */
  evidence: string;
  /** Shows "Read by AI, consequence set by the rule" when an AI judged the evidence. */
  judgedByAI: boolean;
  layout?: 'columns' | 'stack';
}

const Sparkle = () => (
  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="var(--il-color-accent-secondary)" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
  </svg>
);

/** "See why": the cause, the authored rule and the evidence behind an outcome. */
export function ReasonDetail({ cause, rule, evidence, judgedByAI, layout = 'columns' }: ReasonDetailProps) {
  const { t } = useI18n();
  const quote = t('common.quote', { text: evidence });
  if (layout === 'stack') {
    return (
      <div className="flex flex-col gap-2 rounded-14 bg-surface-raised p-3 text-13">
        <span><b className="font-700">{t('reason.why.causeInline')}</b> {cause}</span>
        <span><b className="font-700">{t('reason.why.ruleInline')}</b> {rule}</span>
        <span><b className="font-700">{t('reason.why.evidenceInline')}</b> {quote}</span>
      </div>
    );
  }
  const label = 'text-12 font-700 text-fg-secondary';
  return (
    <div className="grid grid-cols-3 gap-3 rounded-14 bg-surface-raised p-3 text-13">
      <div className="flex flex-col gap-0.5"><b className={label}>{t('reason.why.cause')}</b><span>{cause}</span></div>
      <div className="flex flex-col gap-0.5"><b className={label}>{t('reason.why.rule')}</b><span>{rule}</span></div>
      <div className="flex flex-col gap-0.5">
        <b className={label}>{t('reason.why.evidence')}</b>
        <span>{quote}</span>
        {judgedByAI && <span className="flex items-center gap-1 text-12 text-fg-secondary"><Sparkle />{t('reason.why.ai')}</span>}
      </div>
    </div>
  );
}
