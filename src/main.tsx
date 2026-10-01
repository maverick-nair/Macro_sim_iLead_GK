import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiContext, createDefaultApi } from './api';
import { App } from './app/App';
import { ScreensGallery } from './gallery/ScreensGallery';
import { StatesGallery } from './gallery/StatesGallery';
import './styles/global.css';

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
 * `?theme=light` opens the light theme, `?client=halden` the sample client theme.
 */
function Play() {
  const api = useMemo(createDefaultApi, []);
  const phone = useIsPhone();
  const q = new URLSearchParams(location.search);
  return (
    <ApiContext.Provider value={api}>
      <App key={phone ? 'phone' : 'desk'} theme={q.get('theme') === 'light' ? 'light' : 'dark'} clientTheme={q.get('client') === 'halden'} mobile={phone} minHeight="100vh" />
    </ApiContext.Provider>
  );
}

function Root() {
  const path = location.pathname.replace(/\/+$/, '');
  if (path === '/screens') return <ScreensGallery />;
  if (path === '/states') return <StatesGallery />;
  return <Play />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
