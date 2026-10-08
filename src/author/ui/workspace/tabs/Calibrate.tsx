import { useMemo, useState } from 'react';
import { CalibrateSlot, calibrationPublishCheck, type CalibrationResults } from '../../../calibrate';
import { configHash } from '../../../calibrate/logic/hash';
import { toStoryline } from '../../../model/export';
import { useAuthor } from '../../../model/store';
import { recordCalibration } from '../../../model/validate';
import { TabBody, TabHead } from '../Workspace';

/** The last results, kept for this browser session so leaving the tab and coming back keeps them (the draft stores only the summary). */
let kept: CalibrationResults | null = null;

/**
 * Workspace: Test with synthetic players (docs/design/genie/Calibrate, CalibrateRun; D112 to D119). Mounts
 * the calibration's `CalibrateSlot` on the storyline the draft exports, on the server when `VITE_GENIE_URL`
 * is set and in a Web Worker otherwise, and records the publish check's verdict on the draft.
 */
export default function Calibrate() {
  const draft = useAuthor(s => s.draft);
  const edit = useAuthor(s => s.edit);
  const storyline = useMemo(() => toStoryline(draft).storyline, [draft]);
  const [results, setResults] = useState<CalibrationResults | null>(kept);
  const apiBase = (import.meta.env.VITE_GENIE_URL as string | undefined) ?? null;
  return (
    <TabBody label="Test with synthetic players" head={<TabHead title="Test with synthetic players">Synthetic players at four levels play the whole simulation, conversations included, so you can check it rewards good leadership before real people play.</TabHead>}>
      <CalibrateSlot
        config={storyline}
        apiBase={apiBase}
        results={results}
        heading={false}
        onResults={r => {
          kept = r;
          setResults(r);
          const check = calibrationPublishCheck(r, { draft: storyline });
          // A failure stays on the draft until a full run passes (D132).
          edit(d => { d.calibration = recordCalibration(d.calibration, check, configHash(storyline)); });
        }}
      />
    </TabBody>
  );
}
