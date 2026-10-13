import { useI18n } from '../../i18n';

/**
 * The iLead logo as the approved canvas draws it (D227): the mark, a mint rounded square with the I and the arrow, then the
 * wordmark in the text colour. The mark is decorative; the wordmark is the name.
 */
export function ILeadLogo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const { t } = useI18n();
  const box = size === 'sm' ? 'size-6' : size === 'lg' ? 'size-9' : 'size-7.5';
  const text = size === 'sm' ? 'text-18' : size === 'lg' ? 'text-28' : 'text-22';
  return (
    <span className={`inline-flex flex-none items-center gap-2.5 ${className}`}>
      <svg className={`${box} flex-none`} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--il-color-canvas-mint)" />
        <path d="M10 9v14M16 23V9l7 7" fill="none" stroke="var(--il-color-canvas-navy)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`${text} font-700 tracking-(--il-hud-logo-tracking) text-fg-primary`}>{t('hud.logo')}</span>
    </span>
  );
}
