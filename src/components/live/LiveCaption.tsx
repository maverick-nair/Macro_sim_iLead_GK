import { useI18n } from '../../i18n';

export interface LiveCaptionProps {
  /** First name of the NPC who is speaking. */
  name: string;
  /** The words spoken so far. Grows while `streaming`. */
  text: string;
  /** Shows the blinking caret after the last word while the line streams in. */
  streaming?: boolean;
  /**
   * `stage` sits under the 1:1 portrait (centred, larger type, `size` lg on desktop).
   * `panel` sits under the meeting grid or the sponsor avatar.
   */
  variant?: 'stage' | 'panel';
  /** Stage text size: 18 on desktop, 15 on mobile. */
  size?: 'md' | 'lg';
  /** Centres a panel caption (sponsor briefing). Stage captions are always centred. */
  centered?: boolean;
}

/**
 * Captions for the NPC voice line. A polite live region, so screen readers hear the words as
 * they stream. The design shows no AI label here, so the AI persona note is for assistive
 * technology only.
 */
export function LiveCaption({ name, text, streaming = false, variant = 'stage', size = 'lg', centered = false }: LiveCaptionProps) {
  const { t } = useI18n();
  const ai = <span className="sr-only">{t('live.caption.ai')}</span>;
  if (variant === 'panel') {
    return (
      <div aria-live="polite" className={`rounded-20 border border-line-strong bg-surface-material px-4.5 py-3.5 text-16 ${centered ? 'w-full max-w-130 text-center' : ''}`}>
        <b className="block text-12 font-700 text-fg-secondary">{t('live.caption.label', { name })}{ai}</b>
        <span>{text}</span>
      </div>
    );
  }
  return (
    <div aria-live="polite" className={`max-w-140 rounded-20 border border-line-strong bg-surface-material px-4.5 py-3.5 text-center leading-normal text-pretty ${size === 'lg' ? 'text-18' : 'text-15'}`}>
      <span className="mb-1 block text-12 font-700 text-fg-secondary">{t('live.caption.label', { name })}{ai}</span>
      <span>{text}</span>
      {streaming && <span aria-hidden="true" className="ml-0.75 inline-block h-4.5 w-0.5 animate-(--il-live-caption-cursor) bg-accent-secondary align-middle" />}
    </div>
  );
}
