import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import './messages';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const LINK = `cursor-pointer border-0 bg-transparent p-0 text-13 font-600 text-fg-secondary ${FOCUS}`;

export interface ReportToolbarProps {
  /** Web view: back to the results (absent where there is nowhere to go back to, as in the group report). Print view: back to the web view. */
  onBack?: () => void;
  /** Absent when there is nowhere to send the report (no email service yet). */
  onEmail?: () => void;
  /** Web view: opens the print view and the browser's print dialog. Print view: prints again. */
  onDownload?: () => void;
  /** The print view's toolbar (engine report only; the design's print frame has none). */
  print?: boolean;
}

/** Back to results, Email me, Download PDF. */
export function ReportToolbar({ onBack, onEmail, onDownload, print = false }: ReportToolbarProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {onBack && <button type="button" onClick={onBack} className={LINK}>{t('report.toolbar.back', { print: String(print) })}</button>}
      <span className="flex-1"></span>
      {onEmail && <NoWrapButton variant="secondary" size="sm" onClick={onEmail}>{t('report.toolbar.email')}</NoWrapButton>}
      {onDownload && <NoWrapButton variant="primary" size="sm" onClick={onDownload}>{t('report.toolbar.download', { print: String(print) })}</NoWrapButton>}
    </div>
  );
}
