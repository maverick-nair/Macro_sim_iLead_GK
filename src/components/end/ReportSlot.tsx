import { useEffect, useId, useRef } from 'react';
import type { EngineView } from '../../engine/contract';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';

export interface ReportSlotProps {
  /** The ended run; `view.report` is the development report. */
  view: EngineView;
  /** Open in the print view (Download PDF on the end screen). */
  print: boolean;
  /** Back to the end screen. */
  onBack: () => void;
}

/**
 * TEMPORARY. Where the development report opens from the end screen (View my report, Download PDF).
 * The report itself (`src/components/report/`) is built separately; EngineBoard loads this slot on
 * demand, so swapping it for the report is a one line change of that lazy import. Keep the props.
 */
export function ReportSlot({ print, onBack }: ReportSlotProps) {
  const { t } = useI18n();
  const h1 = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => h1.current?.focus({ preventScroll: true }), []);
  return (
    <section aria-labelledby={id} className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 id={id} ref={h1} tabIndex={-1} className="m-0 text-30 font-700 outline-none">{t('end.slot.title')}</h1>
      <div className="flex min-h-50 w-full max-w-180 items-center justify-center rounded-24 border border-dashed border-line-strong p-8 text-17 text-fg-secondary">
        {t('end.slot.body', { print: String(print) })}
      </div>
      <NoWrapButton variant="secondary" size="md" onClick={onBack}>{t('end.slot.back')}</NoWrapButton>
    </section>
  );
}
