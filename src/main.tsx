import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiContext, createDefaultApi } from './api';
import { App } from './app/App';
import { prefetch } from './app/prefetch';
import { SmallScreenGate } from './app/SmallScreenGate';
import { EngineProvider } from './engine/react';
import { createDefaultClient } from './engine/client';
import { rememberedRun, rememberRun, resilientClient } from './engine/resilient';
import { useMediaQuery } from './lib/useMediaQuery';
import { startTheme, useThemeState } from './theme/bootstrap';
import { appLocale, dirOf, setAppLocale } from './i18n/core';
import { loadEngineCopy, loadLocale } from './i18n/locales';
import './styles/global.css';

// The galleries are review tools; they stay out of the participant's bundle.
const ScreensGallery = lazy(() => import('./gallery/ScreensGallery').then(m => ({ default: m.ScreensGallery })));
// GenieKreator's author chat prototype (D74): for authors, lazy, never in the participant's first load.
const AuthorPage = lazy(() => import('./author/ui/AuthorPage'));
// GenieKreator's synthetic player calibration on its own page (D116), until /author mounts CalibrateSlot. Lazy.
const CalibratePage = lazy(() => import('./author/calibrate/ui/CalibratePage'));
// The organization's group report (D77): not for participants, lazy, never in the participant's first load.
// Its report is requested as soon as a small launch chunk lands, while the page's own code still loads (D78).
const GroupPage = lazy(() => {
  const started = import('./group/launch').then(m => m.startGroup(m.groupLaunch()));
  return Promise.all([import('./group/GroupPage'), started]).then(([m, s]) => ({ default: () => <m.default started={s} /> }));
});
// The report alone in its print view, for the server's PDF renderer (server/src/report/pdf.ts). Lazy.
const PrintReport = lazy(() => import('./app/PrintReport'));
const StatesGallery = lazy(() => import('./gallery/StatesGallery').then(m => ({ default: m.StatesGallery })));
// Dev only: `?report=1` opens the development report of a finished mock run. Production builds drop it.
const ReportDev = import.meta.env.DEV ? lazy(() => import('./gallery/ReportDev').then(m => ({ default: m.ReportDev }))) : null;

/** The participant app's clients, made from the launch link once per load. */
function launch() {
  const q = new URLSearchParams(location.search);
  // The launch link names the participant (LMS or GenieKreator); settings and the session are theirs.
  // Without one (a reload of a bookmark), the run this browser last played resumes (D86).
  const participant = q.get('participant') ?? rememberedRun() ?? 'local';
  rememberRun(participant);
  // `name` stands in for the launch's display name with the mock API (the server reads it from the launch).
  const name = q.get('name');
  // `?history=1`: the mock serves one earlier attempt, for the report's progress section (D75).
  // `exit`: where the game menu's Exit returns to, with the mock API (the server reads it from the launch, D89).
  const api = createDefaultApi(participant, name, { client: q.get('client'), themeUrl: q.get('themeUrl'), history: q.get('history') === '1', exit: q.get('exit') });
  // Intents wait while offline and go out in order on reconnect (D86). The queue is kept on this device
  // only for a server run: the mock engine lives in the page, so a reload starts it afresh.
  const remote = !!import.meta.env.VITE_ILEAD_ENGINE_URL;
  const engine = resilientClient(createDefaultClient(participant), { storage: remote ? undefined : null, key: `ilead.pending.${participant}` });
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
          {covered => <App screen={q.get('start') === 'board' ? 'board' : q.get('start') === 'demo' ? 'demo' : undefined} engine={q.get('engine') !== 'off'} theme={theme} clientTheme={applied} held={covered} minHeight="100vh" fit />}
        </SmallScreenGate>
      </EngineProvider>
    </ApiContext.Provider>
  );
}

// The first view asked for by index.html (D87) names the team: their portraits (the board's largest
// paint) leave now, as the app's code starts, not once the view has been parsed and rendered.
(globalThis as { __ileadEarlyView?: { view: Promise<{ members?: Array<{ img?: string | null }>; sponsor?: { img?: string | null } }> } | null })
  .__ileadEarlyView?.view.then(v => {
    for (const src of new Set([...(v.members ?? []).map(m => m.img), v.sponsor?.img])) {
      if (!src) continue;
      const img = new Image();
      img.fetchPriority = 'high';
      img.src = src;
    }
  }, () => undefined);

// The participant's language from the launch (`?locale=es`, D83): numbers, dates and money follow it, and
// the page's lang and dir. `en-XA` and `ar-XB` are pseudo locales for testing overflow and right to left.
setAppLocale(new URLSearchParams(location.search).get('locale'));
document.documentElement.lang = appLocale();
document.documentElement.dir = dirOf(appLocale());
// The engine's copy loads now, beside the first view (D83).
void loadEngineCopy().catch(() => undefined);

const path = location.pathname.replace(/\/+$/, '');
const play = !['/screens', '/states', '/author', '/author/calibrate', '/group', '/report/print'].includes(path) && !(ReportDev && new URLSearchParams(location.search).get('report') === '1');
const launched = play ? launch() : null;

function Root() {
  if (path === '/screens') return <Suspense><ScreensGallery /></Suspense>;
  if (path === '/states') return <Suspense><StatesGallery /></Suspense>;
  if (path === '/author') return <Suspense><AuthorPage /></Suspense>;
  if (path === '/author/calibrate') return <Suspense><CalibratePage /></Suspense>;
  if (path === '/group') return <Suspense><GroupPage /></Suspense>;
  if (path === '/report/print') return <Suspense><PrintReport /></Suspense>;
  if (ReportDev && new URLSearchParams(location.search).get('report') === '1') return <Suspense><ReportDev /></Suspense>;
  return launched && <Play launched={launched} />;
}

const render = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
// English is in the first load; another language's catalog comes first (a failed load renders in English).
if (appLocale() === 'en') render();
else void loadLocale().catch(e => console.warn('Locale catalog failed to load, showing English', e)).then(render);
