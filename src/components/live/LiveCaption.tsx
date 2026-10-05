import { useI18n } from '../../i18n';
import { LineAnnouncer } from './LiveAnnouncer';

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
  /** Stage text size: 18 under the 1:1 portrait, 15 on the smaller interview stage. */
  size?: 'md' | 'lg';
  /** Centres a panel caption (sponsor briefing). Stage captions are always centred. */
  centered?: boolean;
  /** AI generated lines carry the visually hidden "AI persona voice" note (D27). */
  ai?: boolean;
  /**
   * Announces the finished line once to screen readers (a visually hidden polite region filled when
   * `streaming` turns false). Turn it off where something else announces the line, such as a
   * transcript that stays mounted after the caption goes.
   */
  announce?: boolean;
}

/**
 * Captions for the NPC voice line. The visible caption is not a live region: it changes on every
 * streamed token. Screen readers hear the whole line once, when it has finished, from a visually
 * hidden polite region. The design shows no AI label here, so the AI persona note is for assistive
 * technology only.
 */
export function LiveCaption({ name, text, streaming = false, variant = 'stage', size = 'lg', centered = false, ai: aiGenerated = true, announce = true }: LiveCaptionProps) {
  const { t } = useI18n();
  const ai = aiGenerated && <span className="sr-only">{t('live.caption.ai')}</span>;
  const said = announce && <LineAnnouncer line={{ name, text, streaming, aiGenerated }} />;
  if (variant === 'panel') {
    return (
      <div className={`rounded-20 border border-line-strong bg-surface-material px-4.5 py-3.5 text-16 ${centered ? 'w-full max-w-130 text-center' : ''}`}>
        <b className="block text-12 font-700 text-fg-secondary">{t('live.caption.label', { name })}{ai}</b>
        <span>{text}</span>
        {said}
      </div>
    );
  }
  return (
    <div className={`max-w-140 rounded-20 border border-line-strong bg-surface-material px-4.5 py-3.5 text-center leading-normal text-pretty ${size === 'lg' ? 'text-18' : 'text-15'}`}>
      <span className="mb-1 block text-12 font-700 text-fg-secondary">{t('live.caption.label', { name })}{ai}</span>
      <span>{text}</span>
      {streaming && <span aria-hidden="true" className="ml-0.75 inline-block h-4.5 w-0.5 animate-(--il-live-caption-cursor) bg-accent-secondary align-middle" />}
      {said}
    </div>
  );
}
