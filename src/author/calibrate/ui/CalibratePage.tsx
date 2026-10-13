import { useEffect } from 'react';
import draft from '../../../engine/storylines/sales-elevator.json';
import { CalibrateSlot } from '../index';

/**
 * `/author/calibrate`: the calibration on its own page (D118), for development, review and the E2E test,
 * until the rebuilt /author mounts `<CalibrateSlot>` in its "Test with synthetic players" tab. It plays the
 * bundled Sales Elevator draft. `?theme=light` for the light theme; `?api=/genie` to run on a server.
 */
export default function CalibratePage() {
  const q = new URLSearchParams(location.search);
  const theme = q.get('theme') === 'light' ? 'light' : 'dark';
  useEffect(() => {
    document.title = 'Test with synthetic players';
  }, []);
  return (
    <div className="il-theme min-h-dvh font-sans text-14 leading-(--il-app-leading) text-fg-primary" style={{ colorScheme: theme, background: theme === 'dark' ? 'var(--il-backdrop-office)' : 'var(--il-backdrop-daylight)' }}>
      <main className="mx-auto flex max-w-[1180px] flex-col gap-4 px-7 py-6">
        <p className="m-0 text-13 font-700 text-fg-secondary">GenieKreator · Sales Elevator draft</p>
        <h1 className="sr-only">Sales Elevator draft</h1>
        <CalibrateSlot config={draft} apiBase={q.get('api')} />
      </main>
    </div>
  );
}
