import { useState } from 'react';
import { SURFACES, traceOf, type Surface } from '../../shared/trace';
import { usePreviewAt, type PreviewTarget } from './play';
import { BUTTON } from './kit';

export interface AboutThisProps {
  /** What am I creating? A plain line. */
  what: string;
  /** Why does it matter? What it changes for the participant or the score. */
  why: string;
  /** The storyline paths the section writes: where it appears comes from the traceability registry (D180). */
  paths: string[];
  /** What will the participant experience? In their terms. */
  experience: string;
  /** Where Preview opens, to see it as a participant does (D196). */
  preview?: PreviewTarget;
}

/**
 * The four questions every GenieKreator section answers (docs/PRODUCT.md 3, D221): what it is, why it matters,
 * where it appears (the participant surfaces the registry names for its paths) and what the participant
 * experiences, with Preview to see it there. Folded by default so it never stands between the author and the fields.
 */
export function AboutThis({ what, why, paths, experience, preview }: AboutThisProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const previewAt = usePreviewAt();
  const surfaces = [...new Set(paths.flatMap(p => traceOf(p)?.surfaces ?? []))] as Surface[];
  return (
    <details className="rounded-12 bg-author-track px-4 py-3 text-13 text-author-body">
      <summary className="cursor-pointer font-700 text-author-label">About this section</summary>
      <dl className="m-0 mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 max-[900px]:grid-cols-1">
        <dt className="font-700">What you are creating</dt><dd className="m-0">{what}</dd>
        <dt className="font-700">Why it matters</dt><dd className="m-0">{why}</dd>
        <dt className="font-700">Where it appears</dt>
        <dd className="m-0">
          <ul className="m-0 list-disc ps-5">{surfaces.map(s => <li key={s}>{SURFACES[s]}</li>)}</ul>
        </dd>
        <dt className="font-700">What the participant experiences</dt><dd className="m-0">{experience}</dd>
      </dl>
      {preview && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={BUTTON.secondary} onClick={() => void previewAt(preview).then(r => setProblem(r.ok ? null : r.issues[0] ?? null))}>Preview it as a participant</button>
          {problem && <p role="alert" className="m-0 text-13 font-700 text-author-need">{problem}</p>}
        </div>
      )}
    </details>
  );
}
