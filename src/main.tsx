import { lazy, StrictMode, Suspense, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiContext, createDefaultApi } from './api';
import { App } from './app/App';
import { SmallScreenGate } from './app/SmallScreenGate';
import { EngineProvider } from './engine/react';
import { createDefaultClient } from './engine/client';
import { useMediaQuery } from './lib/useMediaQuery';
import { startTheme, useThemeState } from './theme/bootstrap';
import './styles/global.css';

// The galleries are review tools; they stay out of the participant's bundle.
const ScreensGallery = lazy(() => import('./gallery/ScreensGallery').then(m => ({ default: m.ScreensGallery })));
// GenieKreator's author chat prototype (D74): for authors, lazy, never in the participant's first load.
const AuthorPage = lazy(() => import('./author/ui/AuthorPage'));
const StatesGallery = lazy(() => import('./gallery/StatesGallery').then(m => ({ default: m.StatesGallery })));
// Dev only: `?report=1` opens the development report of a finished mock run. Production builds drop it.
const ReportDev = import.meta.env.DEV ? lazy(() => import('./gallery/ReportDev').then(m => ({ default: m.ReportDev }))) : null;

/**
 * Full screen participant app.
 * `?theme=light` (or `dark`) picks the mode over the client theme's preference, `?client=halden` serves
 * the sample client theme from the mock API (`?themeUrl=/path.json` any theme JSON), `?engine=off` the
 * design prototype's fixed board instead of the engine, `?start=board` skips onboarding.
 * The client theme loads lazily (src/theme, D72): the default theme shows until it lands, and stays on any failure.
 * Laptops, desktops and tablets only (D69): on a smaller screen a notice covers the app (`app/SmallScreenGate.tsx`).
 */
function Play() {
  const q = new URLSearchParams(location.search);
  // The launch link names the participant (LMS or GenieKreator); settings and the session are theirs.
  const participant = q.get('participant') ?? 'local';
  // `name` stands in for the launch's display name with the mock API (the server reads it from the launch).
  const name = q.get('name');
  const client = q.get('client');
  const themeUrl = q.get('themeUrl');
  // `?history=1`: the mock serves one earlier attempt, for the report's progress section (D75).
  const history = q.get('history') === '1';
  const api = useMemo(() => createDefaultApi(participant, name, { client, themeUrl, history }), [participant, name, client, themeUrl, history]);
  const engine = useMemo(() => createDefaultClient(participant), [participant]);
  useEffect(() => startTheme(() => api.getTheme()), [api]);
  const { theme: applied } = useThemeState();
  const systemLight = useMediaQuery('(prefers-color-scheme: light)');
  const param = q.get('theme');
  const preferred = applied?.mode === 'system' ? (systemLight ? 'light' : 'dark') : applied?.mode;
  const theme = param === 'light' || param === 'dark' ? param : preferred === 'light' ? 'light' : 'dark';
  return (
    <ApiContext.Provider value={api}>
      <EngineProvider client={engine}>
        <SmallScreenGate theme={theme} clientTheme={applied}>
          {covered => <App screen={q.get('start') === 'board' ? 'board' : undefined} engine={q.get('engine') !== 'off'} theme={theme} clientTheme={applied} held={covered} minHeight="100vh" />}
        </SmallScreenGate>
      </EngineProvider>
    </ApiContext.Provider>
  );
}

function Root() {
  const path = location.pathname.replace(/\/+$/, '');
  if (path === '/screens') return <Suspense><ScreensGallery /></Suspense>;
  if (path === '/states') return <Suspense><StatesGallery /></Suspense>;
  if (path === '/author') return <Suspense><AuthorPage /></Suspense>;
  if (ReportDev && new URLSearchParams(location.search).get('report') === '1') return <Suspense><ReportDev /></Suspense>;
  return <Play />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
