import { useI18n } from '../../i18n';

/**
 * A visually hidden polite live region. Streaming text never goes into a live region (screen readers
 * would announce every token): pass the whole message once it is final, and an empty string before,
 * so each message is announced exactly once.
 */
export function LiveAnnouncer({ text }: { text: string }) {
  return <span aria-live="polite" aria-atomic="true" className="sr-only">{text}</span>;
}

/** An NPC line as captions and transcripts carry it. */
export interface AnnouncedLine {
  /** Short name of the speaker. */
  name: string;
  text: string;
  /** Still arriving: nothing is announced until it has finished. */
  streaming?: boolean;
  /** AI written lines say so ("Kent, AI persona: ..."), as the visible label does (D27). */
  aiGenerated: boolean;
}

/** Announces an NPC line once, when it has finished streaming. Null or empty announces nothing. */
export function LineAnnouncer({ line }: { line: AnnouncedLine | null }) {
  const { t } = useI18n();
  const text = line && !line.streaming && line.text ? t('live.announce.line', { name: line.name, ai: String(line.aiGenerated), text: line.text }) : '';
  return <LiveAnnouncer text={text} />;
}
