import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiContext, createDefaultApi } from './api';
import { App } from './app/App';
import { prefetch } from './app/prefetch';
import { groupLaunch, startGroup } from './group/launch';
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
// The organization's group report (D77): not for participants, lazy, never in the participant's first load.
const GroupPage = lazy(() => import('./group/GroupPage'));
const StatesGallery = lazy(() => import('./gallery/StatesGallery').then(m => ({ default: m.StatesGallery })));
// Dev only: `?report=1` opens the development report of a finished mock run. Production builds drop it.
const ReportDev = import.meta.env.DEV ? lazy(() => import('./gallery/ReportDev').then(m => ({ default: m.ReportDev }))) : null;

/** The participant app's clients, made from the launch link once per load. */
function launch() {
  const q = new URLSearchParams(location.search);
  // The launch link names the participant (LMS or GenieKreator); settings and the session are theirs.
  const participant = q.get('participant') ?? 'local';
  // `name` stands in for the launch's display name with the mock API (the server reads it from the launch).
  const name = q.get('name');
  // `?history=1`: the mock serves one earlier attempt, for the report's progress section (D75).
  const api = createDefaultApi(participant, name, { client: q.get('client'), themeUrl: q.get('themeUrl'), history: q.get('history') === '1' });
  const engine = createDefaultClient(participant);
  // The first screen's reads leave now, while the app is still starting, not after its first render (D78).
  startTheme(() => api.getTheme());
  const onEngine = q.get('engine') !== 'off';
  return { q, api: prefetch(api, ['getScenario', 'getSession']), engine: onEngine ? prefetch(engine, ['view']) : engine };
}

/**
 * Full screen participant app.
 * `?theme=light` (or `dark`) picks the mode over the client theme's preference, `?client=halden` serves
 * the sample client theme from the mock API (`?themeUrl=/path.json` any theme JSON), `?engine=off` the
 * design prototype's fixed board instead of the engine, `?start=board` skips onboarding.
 * The client theme loads lazily (src/theme, D72): the default theme shows until it lands, and stays on any failure.
 * Laptops, desktops and tablets only (D69): on a smaller screen a notice covers the app (`app/SmallScreenGate.tsx`).
 */
function Play({ launched }: { launched: ReturnType<typeof launch> }) {
  const { q, api, engine } = launched;
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

const path = location.pathname.replace(/\/+$/, '');
const play = !['/screens', '/states', '/author', '/group'].includes(path) && !(ReportDev && new URLSearchParams(location.search).get('report') === '1');
const launched = play ? launch() : null;
const group = path === '/group' ? startGroup(groupLaunch()) : undefined;

function Root() {
  if (path === '/screens') return <Suspense><ScreensGallery /></Suspense>;
  if (path === '/states') return <Suspense><StatesGallery /></Suspense>;
  if (path === '/author') return <Suspense><AuthorPage /></Suspense>;
  if (path === '/group') return <Suspense><GroupPage started={group} /></Suspense>;
  if (ReportDev && new URLSearchParams(location.search).get('report') === '1') return <Suspense><ReportDev /></Suspense>;
  return launched && <Play launched={launched} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
