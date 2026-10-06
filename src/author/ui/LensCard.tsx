import { useId, useState } from 'react';
import type { LibraryLens } from '../lenses';
import { BUTTON, Tag } from './parts';

export interface LensCardProps {
  lens: LibraryLens;
  /** Position in the library, 1 to 8. */
  n: number;
  checked: boolean;
  recommended?: boolean;
  /** Radio group name. */
  name: string;
  disabled?: boolean;
  onSelect: () => void;
}

/** One lens of the library: a radio with its title, description and "Best for"; "More detail" shows "Based on" and the design notes. */
export function LensCard({ lens, n, checked, recommended, name, disabled, onSelect }: LensCardProps) {
  const [open, setOpen] = useState(false);
  const detail = useId();
  const title = useId();
  const about = useId();
  return (
    <div className={`flex flex-col gap-2 rounded-16 border border-solid p-4 ${checked ? 'border-accent-secondary bg-accent-soft' : 'border-line-default bg-surface-card'}`}>
      {/* The label's text (title, description, Best for) sits deeper than the lint rule looks. */}
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className={`flex gap-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input type="radio" name={name} value={lens.id} checked={checked} disabled={disabled} onChange={onSelect} aria-labelledby={title} aria-describedby={about}
          className="mt-1 size-4 shrink-0 accent-(--il-color-accent-default)" />
        <span className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-16 font-700"><span aria-hidden="true">{n}. </span><span id={title}>{lens.title}</span></span>
            {recommended && <Tag>Recommended</Tag>}
          </span>
          <span id={about} className="text-14 text-pretty text-fg-secondary">{lens.description}</span>
          <span className="text-13"><b>Best for:</b> {lens.bestFor}</span>
        </span>
      </label>
      <div className="pl-7">
        <button type="button" className={BUTTON.link} aria-expanded={open} aria-controls={detail} onClick={() => setOpen(o => !o)}>
          {open ? 'Less detail' : 'More detail'}<span className="sr-only"> about {lens.title}</span>
        </button>
        <div id={detail} hidden={!open}>
        <dl className="m-0 mt-2 grid gap-1 text-13">
          <div><dt className="inline font-700">Based on: </dt><dd className="inline m-0 text-fg-secondary">{lens.basedOn}</dd></div>
          <div><dt className="inline font-700">Team: </dt><dd className="inline m-0 text-fg-secondary">{lens.npcDesign}</dd></div>
          <div><dt className="inline font-700">Events: </dt><dd className="inline m-0 text-fg-secondary">{lens.eventDesign}</dd></div>
          {lens.dimensions.length > 0 && <div><dt className="inline font-700">Scoring: </dt><dd className="inline m-0 text-fg-secondary">{lens.dimensions.map(d => d.name).join(', ')}</dd></div>}
        </dl>
        </div>
      </div>
    </div>
  );
}
