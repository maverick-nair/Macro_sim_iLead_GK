import { lazy, Suspense, useMemo, type ComponentType } from 'react';
import type { AuthorDraft } from '../../../model/draft';
import { toStoryline, type Exported } from '../../../model/export';
import { useAuthor } from '../../../model/store';
import { Badge, CARD } from '../../kit';
import { TabBody, TabHead } from '../Workspace';

/**
 * What the Test with synthetic players tab hands the calibration feature (src/author/calibrate, built
 * separately and wired at merge): the draft, the storyline it exports (with any schema issues), and a
 * way to record the result on the draft so Review and publish can show it.
 */
export interface CalibrateSlotProps {
  draft: AuthorDraft;
  exported: Exported;
  onResult: (r: { passed: boolean; summary: string }) => void;
}

// The slot is optional: Vite's glob finds src/author/calibrate/index.ts when it exists, and nothing when it does not.
const found = import.meta.glob<{ CalibrateSlot?: ComponentType<CalibrateSlotProps> }>('../../../calibrate/index.ts');
const loader = Object.values(found)[0];
export const CalibrateSlot = loader
  ? lazy(async () => {
    const m = await loader();
    return { default: m.CalibrateSlot ?? (ComingSoon as ComponentType<CalibrateSlotProps>) };
  })
  : null;

function ComingSoon() {
  return (
    <section aria-labelledby="soon" className={`${CARD} flex max-w-180 flex-col gap-3 p-6`}>
      <div className="flex items-center gap-2"><h2 id="soon" className="m-0 text-18 font-800">Coming soon</h2><Badge kind="muted">Not run yet</Badge></div>
      <p className="m-0 text-15 text-author-body">Synthetic players at four levels, Beginner, Developing, Proficient and Expert, will play the whole simulation, conversations included, so you can check it rewards good leadership before real people play.</p>
      <p className="m-0 text-14 text-author-body">Until then, play a week yourself, and the checks in Review and publish still run on every draft.</p>
    </section>
  );
}

/**
 * Workspace: Test with synthetic players (docs/design/genie/Calibrate, CalibrateRun). The tab renders the
 * `CalibrateSlot` from src/author/calibrate when that module exists, otherwise a coming soon panel (D111).
 */
export default function Calibrate() {
  const draft = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const exported = useMemo(() => toStoryline(draft), [draft]);
  return (
    <TabBody label="Test with synthetic players" head={<TabHead title="Test with synthetic players">Synthetic players at four levels play the whole simulation, conversations included, so you can check it rewards good leadership before real people play.</TabHead>}>
      {CalibrateSlot
        ? <Suspense fallback={<p className="m-0 text-14 text-author-muted">Loading.</p>}><CalibrateSlot draft={draft} exported={exported} onResult={r => edit(d => { d.calibration = { ranAt: Date.now(), ...r }; })} /></Suspense>
        : <ComingSoon />}
    </TabBody>
  );
}
