import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiContext, createMockApi, type IleadApi } from '../api';
import { App } from '../app/App';
import { RootBoundary } from '../app/RootBoundary';
import { SmallScreenGate } from '../app/SmallScreenGate';
import { parseStoryline, type StorylineConfig } from '../engine/config';
import type { EngineClient } from '../engine/client';
import type { Intent } from '../engine/contract';
import { EngineProvider } from '../engine/react';
import { useI18n } from '../i18n';
import { appLocale, dirOf, setAppLocale } from '../i18n/core';
import { loadEngineCopy, loadLocale } from '../i18n/locales';
import { useMediaQuery } from '../lib/useMediaQuery';
import { startTheme, useThemeState } from '../theme/bootstrap';
import { postRun } from './connected';
import { PACKAGE_INFO, PACKAGE_STORYLINE, type PackageInfo } from './package';
import { connectLms, type LmsAdapter } from './scorm';
import { lmsSettingsOf, normalizeLms, type ScormVersion } from './settings';
import { createTracker, trackedClient, type Tracker } from './tracker';

/**
 * Package mode (D208): the participant player inside an LMS. It reads the package's storyline and details
 * from the package itself, finds the LMS, replays the run the LMS kept (D203), plays the storyline on the
 * in-browser engine, and reports through the SCORM adapter (D202, D204). Nothing here needs the iLead
 * server: the leaderboard, Email me and voice input, which do, are left out (connected mode posts runs, D206).
 *
 * `?lms=scorm` on the iLead site tries package mode there: without package files it plays the storyline the
 * site would (`?storyline=draft` for GenieKreator's draft) with this browser's LMS, if any, or none.
 */
export const inPackage = (doc: Document = document) => !!doc.querySelector('meta[name="ilead-package"]');

/** The storyline's site paths (`/assets/npc/kent.webp`) made relative, so they resolve inside the package's folder on the LMS. */
export function relativeAssets<T>(value: T): T {
  if (typeof value === 'string') return (/^\/(assets|fonts)\//.test(value) ? `.${value}` : value) as T;
  if (Array.isArray(value)) return value.map(relativeAssets) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, relativeAssets(v)])) as T;
  return value;
}

/** "Last, First" (SCORM's learner name) as people say it. */
export const learnerName = (raw: string | undefined | null) => {
  const n = (raw ?? '').trim();
  if (!n) return null;
  const [last, first] = n.split(',').map(s => s.trim());
  return first ? `${first} ${last}` : n;
};

async function readJson(path: string): Promise<unknown> {
  const r = await fetch(path, { cache: 'no-store', headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

interface Loaded { info: PackageInfo; config: StorylineConfig }

/** The package's details and storyline; outside a package (`?lms=scorm`), the site's storyline with the defaults. */
async function load(q: URLSearchParams): Promise<Loaded> {
  if (inPackage()) {
    const [info, raw] = await Promise.all([readJson(PACKAGE_INFO), readJson(PACKAGE_STORYLINE)]) as [PackageInfo, unknown];
    const parsed = parseStoryline(relativeAssets(raw));
    if (!parsed.ok) throw new Error(parsed.issues.slice(0, 3).join('; '));
    // The author's choice at download; a package without one reads the storyline's own LMS block.
    return { info: { ...info, settings: info.settings ? normalizeLms(info.settings) : lmsSettingsOf(raw) }, config: parsed.config };
  }
  const { defaultStoryline } = await import('../engine/mock');
  const config = defaultStoryline(q.get('lens'));
  const v = q.get('version');
  const settings = normalizeLms({ ...lmsSettingsOf(config), ...(v === 'scorm12' || v === 'scorm2004' ? { version: v as ScormVersion } : {}) });
  return { info: { format: 1, title: config.name, storylineId: config.id, hash: `site-${config.id}`, version: 0, settings, seed: 1, player: 'site', builtAt: '' }, config };
}

export interface Started { api: IleadApi; engine: EngineClient; tracker: Tracker; adapter: LmsAdapter; info: PackageInfo; locale: string }

/** Everything package mode needs before its first render. `win` is where the LMS's API is looked for. */
export async function startPackage(win: Window = window, q = new URLSearchParams(location.search)): Promise<Started> {
  const { info, config } = await load(q);
  // The leaderboard ranks against a cohort, which only the iLead server has (D208).
  config.gamification.leaderboard.enabled = false;
  const { createMockClient, pinStoryline } = await import('../engine/mock');
  // The demo round's engine plays this storyline too.
  pinStoryline(config);
  const adapter = connectLms(win as never, info.settings.version);
  const learner = adapter.learner();
  const service = info.settings.connected ? info.service : undefined;
  let tracker: Tracker | null = null;
  tracker = createTracker({
    adapter, settings: info.settings, hash: info.hash, seed: info.seed, skills: config.report.skills.map(s => ({ key: s.key, name: s.name })),
    onCheckpoint: service ? state => void postRun(service, { packageId: service.packageId, hash: info.hash, seed: info.seed, learner, state, log: tracker!.log }) : undefined
  });
  const resume = tracker.resumeLog();
  let applied: Intent[] = [];
  const inner = createMockClient({ config, seed: info.seed, replay: resume, onReplayed: a => { applied = a; } });
  // The first view waits for the replay; the LMS hears where the run stands before anything is played.
  tracker.begin(await inner.view(), applied);
  const finish = () => tracker.finish();
  win.addEventListener('pagehide', finish);
  win.addEventListener('beforeunload', finish);
  const participant = `scorm-${info.hash.slice(0, 12)}-${learner?.id || 'local'}`;
  const mock = createMockApi({ participant, name: learnerName(learner?.name), latencyMs: 0 });
  const api: IleadApi = {
    ...mock,
    features: { email: false },
    emailReport: () => Promise.reject(new Error('No email service in a SCORM package')),
    getLeaderboard: () => Promise.reject(new Error('No leaderboard in a SCORM package')),
    getHistory: () => Promise.resolve(null),
    reportPdf: () => Promise.resolve(null)
  };
  return { api, engine: trackedClient(inner, tracker), tracker, adapter, info, locale: config.locale };
}

function PackagePlay({ started, look }: { started: Started; look: 'light' | 'dark' | null }) {
  const { theme: applied } = useThemeState();
  const systemLight = useMediaQuery('(prefers-color-scheme: light)');
  const preferred = applied?.mode === 'system' ? (systemLight ? 'light' : 'dark') : applied?.mode;
  const theme = look ?? (preferred === 'light' ? 'light' : 'dark');
  return (
    <ApiContext.Provider value={started.api}>
      <EngineProvider client={started.engine}>
        <SmallScreenGate theme={theme} clientTheme={applied}>
          {covered => <App engine theme={theme} clientTheme={applied} held={covered} minHeight="100vh" fit voice={false} />}
        </SmallScreenGate>
      </EngineProvider>
    </ApiContext.Provider>
  );
}

function LoadFailed() {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  useEffect(() => { void import('./messages').then(() => setReady(true)); }, []);
  return (
    <main className="il-theme flex min-h-dvh items-center justify-center bg-surface-solid p-8 text-fg-primary">
      {ready && <p role="alert" className="m-0 max-w-[36rem] text-16 leading-normal">{t('lms.player.loadFailed')}</p>}
    </main>
  );
}

/** Starts package mode on the page's root element. */
export async function bootPackage(el: HTMLElement) {
  const root = createRoot(el);
  const q = new URLSearchParams(location.search);
  let started: Started;
  try {
    started = await startPackage(window, q);
  } catch (e) {
    console.error('The package could not start', e);
    root.render(<StrictMode><LoadFailed /></StrictMode>);
    return;
  }
  // The storyline's language unless the launch names one (`?locale=`, D83).
  setAppLocale(q.get('locale') ?? started.locale);
  document.documentElement.lang = appLocale();
  document.documentElement.dir = dirOf(appLocale());
  if (appLocale() !== 'en') await loadLocale().catch(e => console.warn('Locale catalog failed to load, showing English', e));
  void loadEngineCopy().catch(() => undefined);
  startTheme(() => started.api.getTheme());
  const param = q.get('theme');
  const look = param === 'light' || param === 'dark' ? param : started.info.look ?? null;
  root.render(<StrictMode><RootBoundary><PackagePlay started={started} look={look} /></RootBoundary></StrictMode>);
}
