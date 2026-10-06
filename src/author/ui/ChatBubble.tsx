import type { ReactNode } from 'react';
import { BUTTON } from './parts';

export interface ChatBubbleProps {
  from: 'assistant' | 'author';
  children: ReactNode;
  /** Author answers: reopens the question. `question` names the edit link for screen readers. */
  onEdit?: () => void;
  question?: string;
  /** Marks the answer being edited. */
  editing?: boolean;
}

/** One message in the author chat: GenieKreator's question or note on the left, the author's answer on the right with an Edit link. */
export function ChatBubble({ from, children, onEdit, question, editing }: ChatBubbleProps) {
  const mine = from === 'author';
  return (
    <div className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
      <span className="sr-only">{mine ? 'You said:' : 'GenieKreator:'}</span>
      <div className={`max-w-[85%] rounded-18 px-4 py-2.5 text-15 leading-relaxed whitespace-pre-wrap text-pretty ${mine ? 'rounded-br-4 bg-accent-default text-fg-on-accent' : 'rounded-bl-4 border border-solid border-line-default bg-surface-raised text-fg-primary'} ${editing ? 'outline-2 outline-offset-2 outline-accent-secondary outline-dashed' : ''}`}>
        {children}
      </div>
      {mine && onEdit && (
        <button type="button" className={BUTTON.link} onClick={onEdit} aria-label={`Edit your answer to: ${question ?? 'this question'}`}>
          {editing ? 'Editing' : 'Edit'}
        </button>
      )}
    </div>
  );
}
