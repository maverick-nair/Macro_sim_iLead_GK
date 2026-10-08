import '../author.css';
import { useEffect, useMemo, type ReactNode } from 'react';
import type { StoreApi } from 'zustand';
import { SmallScreenGate } from '../../app/SmallScreenGate';
import type { Drafter } from '../drafter';
import { AuthorStoreContext, bindAuthorStore, createAuthorStore, useAuthor, type AuthorState } from '../model/store';
import { DraftReady } from './journey/DraftReady';
import { JourneyPage } from './journey/Journey';
import { LibraryAdmin } from './library/LibraryAdmin';
import { navigate, useRoute, type Route } from './route';
import { AuthorBoundary } from './safety/Boundary';
import { SafetyNotices } from './safety/SafetyNotices';
import { Workspace } from './workspace/Workspace';

/** The authoring tool's root: the canvas's light look, whatever the participant theme (D105). */
export function AuthorRoot({ children }: { children: ReactNode }) {
  return <div className="il-theme min-h-dvh bg-author-canvas font-sans text-14 leading-[1.4] text-author-ink [color-scheme:light]">{children}</div>;
}

export function AuthorRoutes({ route, drafters }: { route: Route; drafters?: Drafter[] }) {
  const stage = useAuthor(s => s.draft.stage);
  // A draft in the workspace opens there; the chat's route only shows the chat and First draft ready.
  useEffect(() => { if (route.page === 'journey' && stage === 'workspace') navigate({ page: 'workspace', tab: 'overview' }); }, [route.page, stage]);
  if (route.page === 'library') return <LibraryAdmin />;
  if (route.page === 'workspace') return <Workspace tab={route.tab} />;
  return stage === 'chat' ? <JourneyPage drafters={drafters} /> : <DraftReady />;
}

/**
 * The store, saved at once when the page is hidden or closed and told when another tab changes the
 * draft (D123); the notices that say when work is at risk above every page; and a boundary that
 * shows a message with Reload instead of a blank page. The pages fit the frame below the notices.
 */
export function AuthorApp({ store, drafters, route }: { store?: StoreApi<AuthorState>; drafters?: Drafter[]; route?: Route }) {
  const s = useMemo(() => store ?? createAuthorStore(), [store]);
  const current = useRoute();
  useEffect(() => bindAuthorStore(s), [s]);
  return (
    <AuthorStoreContext.Provider value={s}>
      <AuthorRoot>
        <div className="flex h-dvh flex-col overflow-hidden">
          <SafetyNotices />
          <div className="author-frame flex min-h-0 flex-1 flex-col">
            <AuthorBoundary whole><AuthorRoutes route={route ?? current} drafters={drafters} /></AuthorBoundary>
          </div>
        </div>
      </AuthorRoot>
    </AuthorStoreContext.Provider>
  );
}

/**
 * The `/author` routes (D105), loaded lazily by main.tsx so the participant's first load never carries
 * them. Laptops and tablets; narrower than 744 the small screen notice covers it (D69).
 */
export default function AuthorPage() {
  useEffect(() => { document.title = 'GenieKreator'; }, []);
  return (
    <SmallScreenGate theme="light" clientTheme={null}>
      {() => <AuthorApp />}
    </SmallScreenGate>
  );
}
