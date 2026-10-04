import { useId, useState } from 'react';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';

export interface ComposerProps {
  /** "1:1 conversation, Kent". */
  title: string;
  busy: boolean;
  onSubmit: (text: string) => void;
}

/**
 * Text entry for a live interaction, shown in the actions panel. A stand in for the live shell
 * (voice, streaming replies) that M4 builds; the engine contract is the same either way.
 */
export function Composer({ title, busy, onSubmit }: ComposerProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const id = useId();
  const send = () => { if (text.trim() && !busy) onSubmit(text.trim()); };
  return (
    <div className="flex flex-1 flex-col gap-3 px-4.5 py-4">
      <b className="text-16">{title}</b>
      <label htmlFor={id} className="text-12 font-700 text-fg-secondary">{t('board.composer.label')}</label>
      <textarea
        id={id}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
        rows={8}
        disabled={busy}
        className="resize-none rounded-14 border border-line-default bg-surface-raised p-3 text-14 text-fg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary"
      />
      <span className="text-12 text-fg-secondary">{t('board.composer.hint')}</span>
      <div className="flex justify-end">
        <Button variant="primary" size="md" disabled={busy || !text.trim()} onClick={send}>
          {busy ? t('board.composer.sending') : t('board.composer.send')}
        </Button>
      </div>
    </div>
  );
}
