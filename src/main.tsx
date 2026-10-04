import { lazy, StrictMode, Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiContext, createDefaultApi } from './api';
import { App } from './app/App';
import { EngineProvider } from './engine/react';
import { createDefaultClient } from './engine/client';
import './styles/global.css';

// The galleries are review tools; they stay out of the participant's bundle.
const ScreensGallery = lazy(() => import('./gallery/ScreensGallery').then(m => ({ default: m.ScreensGallery })));
const StatesGallery = lazy(() => import('./gallery/StatesGallery').then(m => ({ default: m.StatesGallery })));

/** Phones get the 390 layouts the design defines for live interactions, outcomes and the report. */
function useIsPhone(): boolean {
  const query = '(max-width: 600px)';
  const [phone, setPhone] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

/**
 * Full screen participant app.
 * `?theme=light` opens the light theme, `?client=halden` the sample client theme, `?engine=off` the
 * design prototype's fixed board instead of the engine, `?start=board` skips onboarding.
 * Phones keep the prototype until the 390 board is designed (D15).
 */
function Play() {
  const q = new URLSearchParams(location.search);
  // The launch link names the participant (LMS or GenieKreator); settings and the session are theirs.
  const participant = q.get('participant') ?? 'local';
  const api = useMemo(() => createDefaultApi(participant), [participant]);
  const engine = useMemo(() => createDefaultClient(participant), [participant]);
  const phone = useIsPhone();
  return (
    <ApiContext.Provider value={api}>
      <EngineProvider client={engine}>
        <App key={phone ? 'phone' : 'desk'} screen={q.get('start') === 'board' ? 'board' : undefined} engine={!phone && q.get('engine') !== 'off'} theme={q.get('theme') === 'light' ? 'light' : 'dark'} clientTheme={q.get('client') === 'halden'} mobile={phone} minHeight="100vh" />
      </EngineProvider>
    </ApiContext.Provider>
  );
}

function Root() {
  const path = location.pathname.replace(/\/+$/, '');
  if (path === '/screens') return <Suspense><ScreensGallery /></Suspense>;
  if (path === '/states') return <Suspense><StatesGallery /></Suspense>;
  return <Play />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
