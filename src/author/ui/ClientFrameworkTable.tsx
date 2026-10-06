import type { FrameworkDimension } from '../../api/author';
import { BUTTON, FOCUS } from './parts';

export interface ClientFrameworkTableProps {
  dimensions: FrameworkDimension[];
  onChange: (dimensions: FrameworkDimension[]) => void;
  onConfirm?: () => void;
  confirmed?: boolean;
  disabled?: boolean;
}

const FIELD = `w-full rounded-10 border border-solid border-line-control bg-surface-solid px-2.5 py-1.5 text-14 text-fg-primary ${FOCUS}`;
const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);
const items = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

/**
 * Module step 5: the dimensions, observable behaviours and proficiency levels read from the client's
 * framework, in a short table the author confirms or edits. Nothing here is invented: rows come from the
 * document or from the author.
 */
export function ClientFrameworkTable({ dimensions, onChange, onConfirm, confirmed, disabled }: ClientFrameworkTableProps) {
  const set = (i: number, d: Partial<FrameworkDimension>) => onChange(dimensions.map((x, j) => (j === i ? { ...x, ...d } : x)));
  const named = dimensions.filter(d => d.name.trim());
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-14">
          <caption className="sr-only">Client framework dimensions</caption>
          <thead>
            <tr className="text-13 text-fg-secondary">
              <th scope="col" className="w-1/4 p-2 font-700">Dimension</th>
              <th scope="col" className="p-2 font-700">Observable behaviors (one per line)</th>
              <th scope="col" className="w-1/4 p-2 font-700">Levels (comma separated)</th>
              <th scope="col" className="p-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {dimensions.map((d, i) => (
              <tr key={i} className="border-t border-solid border-line-default align-top">
                <td className="p-2"><input className={FIELD} aria-label={`Dimension ${i + 1} name`} value={d.name} disabled={disabled} onChange={e => set(i, { name: e.target.value })} /></td>
                <td className="p-2"><textarea className={FIELD} rows={Math.max(2, d.behaviours.length)} aria-label={`Dimension ${i + 1} behaviors`} value={d.behaviours.join('\n')} disabled={disabled} onChange={e => set(i, { behaviours: lines(e.target.value) })} /></td>
                <td className="p-2"><input className={FIELD} aria-label={`Dimension ${i + 1} levels`} value={d.levels.join(', ')} disabled={disabled} onChange={e => set(i, { levels: items(e.target.value) })} /></td>
                <td className="p-2"><button type="button" className={BUTTON.link} disabled={disabled} onClick={() => onChange(dimensions.filter((_, j) => j !== i))}>Remove<span className="sr-only"> dimension {i + 1}</span></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BUTTON.secondary} disabled={disabled} onClick={() => onChange([...dimensions, { name: '', behaviours: [], levels: [] }])}>Add a dimension</button>
        {onConfirm && <button type="button" className={BUTTON.primary} disabled={disabled || named.length < 2 || confirmed} onClick={onConfirm}>{confirmed ? 'Framework confirmed' : 'Confirm framework'}</button>}
        {named.length < 2 && <span className="text-13 text-fg-secondary">Confirm at least 2 dimensions.</span>}
      </div>
    </div>
  );
}
