import { useI18n } from '../../i18n';

const focus = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';

const FunnelIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h18l-7 8v6l-4 2v-8z" /></svg>
);

/** The button that opens the funnel, beside "Your team" on the board (D242). */
export function FunnelButton({ onOpen, bottleneck }: { onOpen: () => void; bottleneck: string | null }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onOpen} aria-haspopup="dialog" data-tour="funnel"
      className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-4 border border-solid border-line-strong bg-surface-card px-3 text-13 font-600 whitespace-nowrap text-fg-primary hover:border-line-control ${focus}`}>
      <FunnelIcon />{t('funnel.open')}
      {bottleneck && <span className="font-500 text-status-attention">{t('funnel.openBottleneck', { stage: bottleneck })}</span>}
    </button>
  );
}
