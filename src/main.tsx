import { lazy, StrictMode, Suspense, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiContext, createDefaultApi } from './api';
import { App } from './app/App';
import { SmallScreenGate } from './app/SmallScreenGate';
import { EngineProvider } from './engine/react';
import { createDefaultClient } from './engine/client';
import './styles/global.css';

// The galleries are review tools; they stay out of the participant's bundle.
const ScreensGallery = lazy(() => import('./gallery/ScreensGallery').then(m => ({ default: m.ScreensGallery })));
const StatesGallery = lazy(() => import('./gallery/StatesGallery').then(m => ({ default: m.StatesGallery })));
// Dev only: `?report=1` opens the development report of a finished mock run. Production builds drop it.
const ReportDev = import.meta.env.DEV ? lazy(() => import('./gallery/ReportDev').then(m => ({ default: m.ReportDev }))) : null;

/**
 * Full screen participant app.
 * `?theme=light` opens the light theme, `?client=halden` the sample client theme, `?engine=off` the
 * design prototype's fixed board instead of the engine, `?start=board` skips onboarding.
 * Laptops, desktops and tablets only (D69): on a smaller screen a notice covers the app (`app/SmallScreenGate.tsx`).
 */
function Play() {
  const q = new URLSearchParams(location.search);
  // The launch link names the participant (LMS or GenieKreator); settings and the session are theirs.
  const participant = q.get('participant') ?? 'local';
  // `name` stands in for the launch's display name with the mock API (the server reads it from the launch).
  const name = q.get('name');
  const api = useMemo(() => createDefaultApi(participant, name), [participant, name]);
  const engine = useMemo(() => createDefaultClient(participant), [participant]);
  const theme = q.get('theme') === 'light' ? 'light' : 'dark';
  const client = q.get('client') === 'halden';
  return (
    <ApiContext.Provider value={api}>
      <EngineProvider client={engine}>
        <SmallScreenGate theme={theme} clientTheme={client}>
          {covered => <App screen={q.get('start') === 'board' ? 'board' : undefined} engine={q.get('engine') !== 'off'} theme={theme} clientTheme={client} held={covered} minHeight="100vh" />}
        </SmallScreenGate>
      </EngineProvider>
    </ApiContext.Provider>
  );
}

function Root() {
  const path = location.pathname.replace(/\/+$/, '');
  if (path === '/screens') return <Suspense><ScreensGallery /></Suspense>;
  if (path === '/states') return <Suspense><StatesGallery /></Suspense>;
  if (ReportDev && new URLSearchParams(location.search).get('report') === '1') return <Suspense><ReportDev /></Suspense>;
  return <Play />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
