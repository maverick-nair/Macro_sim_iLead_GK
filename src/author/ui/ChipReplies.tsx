import { FOCUS } from './parts';

export interface ChipRepliesProps {
  chips: Array<{ label: string; value: string; detail?: string }>;
  onPick: (value: string) => void;
  /** Names the group for screen readers. */
  label?: string;
  disabled?: boolean;
}

/** Quick replies: common answers as chips. Free text stays available beside them. */
export function ChipReplies({ chips, onPick, label = 'Suggested answers', disabled }: ChipRepliesProps) {
  if (!chips.length) return null;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {chips.map(c => (
        <button key={c.value} type="button" disabled={disabled} onClick={() => onPick(c.value)}
          className={`flex min-h-9 cursor-pointer flex-col items-start rounded-14 border border-solid border-line-strong bg-surface-card px-3.5 py-1.5 text-start text-14 font-600 text-fg-primary hover:border-accent-secondary hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>
          <span>{c.label}</span>
          {c.detail && <span className="text-12 font-400 text-fg-secondary">{c.detail}</span>}
        </button>
      ))}
    </div>
  );
}
