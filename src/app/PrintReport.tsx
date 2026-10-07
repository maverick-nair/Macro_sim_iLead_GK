import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createDefaultApi } from '../api';
import { EngineReport } from '../components/report/EngineReport';
import { LoadingScreen } from '../components/shell/LoadingScreen';
import { createDefaultClient } from '../engine/client';
import type { EngineView } from '../engine/contract';
import { I18nProvider } from '../i18n';
import { BrandContext } from '../theme/brand';
import { startTheme, useThemeState } from '../theme/bootstrap';

/**
 * `/report/print?participant=<id>`: the participant's report in its print view, alone on the page, for the
 * server's PDF renderer (headless Chromium, server/src/report/pdf.ts). It reads the run through the same
 * adapters as the app (the engine view, the profile, the history) and marks the page
 * `data-print-state="ready"` once the report and its history have rendered, or `"error"` when it cannot.
 * Light (Paper) unless `&theme=dark`. Lazy: never in the participant's first load.
 */
export default function PrintReport() {
  const q = useMemo(() => new URLSearchParams(location.search), []);
  const participant = q.get('participant') ?? 'local';
  const api = useMemo(() => createDefaultApi(participant), [participant]);
  const dark = q.get('theme') === 'dark';
  const [state, setState] = useState<{ view: EngineView; name: string | null; history: unknown } | 'error' | null>(null);
  const [painted, setPainted] = useState(false);
  const { theme: client } = useThemeState();

  useEffect(() => startTheme(() => api.getTheme()), [api]);
  useEffect(() => {
    let alive = true;
    const history = api.getHistory().catch(() => null);
    Promise.all([createDefaultClient(participant).view(), api.getProfile().catch(() => ({ name: null })), history])
      .then(([view, profile, h]) => { if (alive) setState(view.report ? { view, name: profile.name, history: h } : 'error'); }, () => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [api, participant]);
  // Ready after two frames: the report and its history section have laid out.
  useEffect(() => {
    if (!state || state === 'error') return;
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => setPainted(true)); });
    return () => cancelAnimationFrame(id);
  }, [state]);

  const root: CSSProperties = { colorScheme: dark ? 'dark' : 'light', minHeight: '100vh', background: dark ? 'var(--il-backdrop-office)' : 'var(--il-backdrop-daylight)' };
  const status = state === 'error' ? 'error' : painted ? 'ready' : 'loading';
  return (
    <I18nProvider>
      <BrandContext.Provider value={client?.brand ?? null}>
        <div style={root} data-print-state={status}>
          <div className="il-theme relative flex flex-col overflow-hidden font-sans text-14 leading-(--il-app-leading) text-fg-primary tabular-nums [min-height:inherit]">
            {state && state !== 'error'
              ? <EngineReport view={state.view} print onBack={() => history.back()} participantName={state.name} getHistory={() => Promise.resolve(state.history)} />
              : state === 'error' ? <main className="p-8"><h1 className="m-0 text-24 font-700">The report is not ready</h1></main> : <LoadingScreen />}
          </div>
        </div>
      </BrandContext.Provider>
    </I18nProvider>
  );
}
