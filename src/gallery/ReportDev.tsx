import { useEffect, useState, type CSSProperties } from 'react';
import type { EngineView } from '../engine/contract';
import { I18nProvider } from '../i18n';
import { LoadingScreen } from '../components/shell/LoadingScreen';
import { EngineReport } from '../components/report/EngineReport';
import { createMockApi } from '../api';
import { BrandContext } from '../theme/brand';
import { startTheme, useThemeState } from '../theme/bootstrap';

/**
 * Dev only (`/?report=1`, never in the production bundle): plays a whole run on the mock engine with an
 * automated player and opens the development report from its ended view, so the report can be seen and
 * tested without playing eight weeks. `&policy=random` or `passive`, `&seed=5`, `&print=1`, `&theme=light`,
 * `&client=halden` or `&themeUrl=/path.json` (a client theme through the mock API and the theme loader, as in play), `&participant=<name>`,
 * `&purpose=assessment` (an assessment report with verdicts), `&lens=six_styles`, `&history=1` (one earlier attempt for the progress section).
 */
export function ReportDev() {
  const q = new URLSearchParams(location.search);
  const light = q.get('theme') === 'light';
  // The client theme, loaded and applied on :root the way the app does it (D72).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- launch parameters, read once
  useEffect(() => startTheme(() => createMockApi({ latencyMs: 0, client: q.get('client'), themeUrl: q.get('themeUrl') }).getTheme()), []);
  const { theme: client } = useThemeState();
  const [view, setView] = useState<EngineView | null>(null);
  useEffect(() => {
    void import('../engine/mock').then(m => m.playToEnd({
      policy: q.get('policy') === 'random' || q.get('policy') === 'passive' ? q.get('policy') as 'random' | 'passive' : 'good',
      seed: Number(q.get('seed')) || 3,
      config: m.defaultStoryline(q.get('lens')),
      reflection: ['Kent taught me that the loudest problem is not always the real one.']
    })).then(setView);
    // Read once, like the app's other launch parameters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const root: CSSProperties = {
    colorScheme: light ? 'light' : 'dark', minHeight: '100vh',
    background: light ? 'var(--il-backdrop-daylight)' : 'var(--il-backdrop-office)',
  };
  return (
    <I18nProvider>
      <BrandContext.Provider value={client?.brand ?? null}>
      <div style={root}>
        <div className="il-theme relative flex flex-col overflow-hidden font-sans text-14 leading-(--il-app-leading) text-fg-primary tabular-nums [min-height:inherit]">
          {view
            ? <EngineReport view={view} onBack={() => location.assign('/')} print={q.get('print') === '1'} participantName={q.get('participant') ?? 'Jordan Lee'} date={new Date(2026, 9, 5)}
                getHistory={() => createMockApi({ latencyMs: 0, history: q.get('history') === '1' }).getHistory()} />
            : <LoadingScreen />}
        </div>
      </div>
      </BrandContext.Provider>
    </I18nProvider>
  );
}
