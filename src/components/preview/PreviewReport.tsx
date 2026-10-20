import { lazy, Suspense } from 'react';
import { useApi } from '../../api';
import { useEngineView } from '../../engine/react';

const EngineReport = lazy(() => import('../report/EngineReport'));

/**
 * A preview's "End and report" (D192): the report of the run played to its end, opened at once. Back goes
 * to the end screen's flow on the board, as a participant would come to it. The preview's API is the
 * mock's, so the report shows no earlier attempts and offers no email.
 */
export default function PreviewReport({ onBack }: { onBack: () => void }) {
  const view = useEngineView().data;
  const api = useApi();
  if (!view || view.phase !== 'ended') return null;
  return (
    <Suspense>
      <div data-trace="report"><EngineReport view={view} onBack={onBack} getPdf={() => api.reportPdf()} getHistory={async () => null} /></div>
    </Suspense>
  );
}
