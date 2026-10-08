import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useMediaQuery } from '../../../lib/useMediaQuery';
import type { Tab } from '../../model/draft';
import { needsOf, tabStatus } from '../../model/needs';
import { useAuthor } from '../../model/store';
import { Badge, BUTTON, FOCUS, Icon, savedText, Scroll } from '../kit';
import { playDraft } from '../play';
import { navigate } from '../route';
import { NAV } from '../sections';
import { KoraPanel } from './KoraPanel';

const Tabs = {
  overview: lazy(() => import('./tabs/Overview')),
  brief: lazy(() => import('./tabs/Brief')),
  story: lazy(() => import('./tabs/Story')),
  process: lazy(() => import('./tabs/Process')),
  team: lazy(() => import('./tabs/Team')),
  lens: lazy(() => import('./tabs/Lens')),
  actions: lazy(() => import('./tabs/Actions')),
  events: lazy(() => import('./tabs/Events')),
  scoring: lazy(() => import('./tabs/Scoring')),
  brand: lazy(() => import('./tabs/Brand')),
  calibrate: lazy(() => import('./tabs/Calibrate')),
  publish: lazy(() => import('./tabs/Publish'))
} satisfies Record<Tab, unknown>;

/** Tabs that show Ask Kora beside them (the lens and actions too, where decisions are designed, D125); publish uses the full width. */
const WITH_KORA: Tab[] = ['overview', 'brief', 'story', 'process', 'team', 'lens', 'actions', 'events', 'scoring', 'brand', 'calibrate'];

/** A tab's heading row: the title, one line on what it holds, and its actions. */
export function TabHead({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className="flex flex-none flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 ref={h} tabIndex={-1} className="m-0 text-30 leading-[1.15] font-800 outline-none short:text-26">{title}</h1>
        {children && <p className="m-0 text-15 text-author-body">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** The scrolling body of a tab, with its heading pinned above. */
export function TabBody({ head, children, label }: { head: ReactNode; children: ReactNode; label: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-7 pt-6 pb-0 max-[1100px]:px-5 short:pt-4">
      {head}
      <Scroll label={label} className="-mx-2 flex-1 px-2 pb-6">{children}</Scroll>
    </div>
  );
}

function NavMark({ tab }: { tab: Tab }) {
  const draft = useAuthor(s => s.draft);
  const st = tab === 'publish' ? (needsOf(draft).length ? 'need' : 'yours') : tabStatus(draft, tab);
  const n = NAV.find(x => x.tab === tab)!.n;
  if (st === 'need') return <span className="flex size-6 shrink-0 items-center justify-center rounded-round bg-author-need-badge text-12 font-800 text-author-need" aria-label="needs you">!</span>;
  if (st === 'yours' && tab !== 'calibrate') return <span className="flex size-6 shrink-0 items-center justify-center rounded-round bg-author-gain-soft text-author-gain" aria-label="mostly yours">{Icon.check(12)}</span>;
  return <span className="flex size-6 shrink-0 items-center justify-center rounded-round bg-author-ai-badge text-12 font-800 text-author-ai" aria-label="generated">{n ?? Icon.check(12)}</span>;
}

/**
 * The workspace (docs/design/genie/Overview and every tab, D105): the header with the draft's state, the
 * section nav with a status per section, the tab, and Ask Kora beside it. Fits the window: from 1280 wide
 * three columns; from 1024 the nav and the tab, with Ask Kora as a panel that opens over the tab; below
 * 1024 the nav becomes a row of links above the tab. Each column scrolls on its own; the header's
 * actions never scroll away.
 */
export function Workspace({ tab }: { tab: Tab }) {
  const draft = useAuthor(s => s.draft);
  const saved = useAuthor(s => savedText(s.savedAt, s.saveFailed));
  const edit = useAuthor(s => s.edit);
  const wide = useMediaQuery('(min-width: 1280px)');
  const tablet = !useMediaQuery('(min-width: 1024px)');
  const [kora, setKora] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const needs = needsOf(draft).length;
  const Page = Tabs[tab];
  const showKora = WITH_KORA.includes(tab);
  useEffect(() => { if (draft.stage !== 'workspace') edit(d => { d.stage = 'workspace'; }); }, [draft.stage, edit]);
  useEffect(() => { document.title = `${NAV.find(n => n.tab === tab)!.label}, ${draft.title}: GenieKreator`; }, [tab, draft.title]);

  const play = () => {
    const r = playDraft(draft);
    if (r.ok) edit(d => { d.publish.played = true; });
    setProblem(r.ok ? null : `This draft does not play yet. ${r.issues[0]}`);
  };

  const nav = (
    <nav aria-label="Sections" className={tablet ? 'flex-none border-b border-solid border-author-line bg-author-surface' : 'flex min-h-0 flex-col border-e border-solid border-author-line bg-author-surface'}>
      <Scroll label="Sections list" className={tablet ? 'overflow-x-auto overflow-y-hidden' : 'flex-1 px-3 pt-4'}>
        <ul className={`m-0 list-none p-0 ${tablet ? 'flex gap-1 px-3 py-2' : 'flex flex-col gap-0.5'}`}>
          {NAV.map(n => (
            <li key={n.tab}>
              <a href={`/author/workspace/${n.tab}`} aria-current={n.tab === tab ? 'page' : undefined}
                onClick={e => { e.preventDefault(); navigate({ page: 'workspace', tab: n.tab }); }}
                className={`flex min-h-11 items-center gap-3 rounded-12 px-3 text-15 font-800 no-underline ${tablet ? 'whitespace-nowrap' : ''} ${n.tab === tab ? 'bg-author-primary-soft text-author-primary' : 'text-author-ink hover:bg-author-track'} ${FOCUS}`}>
                <NavMark tab={n.tab} />
                <span className="leading-[1.15]">{n.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </Scroll>
      {!tablet && (
        <div className="m-3 flex flex-none flex-col gap-1 rounded-12 bg-author-track p-3 text-12 text-author-body short:hidden" aria-label="Key">
          <b className="text-author-ink">Key</b>
          <span className="flex items-center gap-2"><Badge kind="you">You</Badge> mostly from you</span>
          <span className="flex items-center gap-2"><Badge kind="ai" /> generated by Kora</span>
          <span className="flex items-center gap-2"><Badge kind="need" /> required, still empty</span>
        </div>
      )}
    </nav>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex min-h-16 flex-none items-center gap-3 border-b border-solid border-author-line bg-author-surface px-6 py-2 max-[1100px]:gap-2 max-[1100px]:px-4">
        <span className="shrink-0 text-20 font-800 max-[1100px]:text-18">Genie<span className="text-author-kora">Kreator</span></span>
        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-author-line max-[1100px]:hidden" />
        <span className="min-w-0 shrink truncate text-16 font-800" title={draft.title}>{draft.title}</span>
        {needs > 0 ? <Badge kind="need"><span className="max-[1100px]:sr-only">Draft &middot; </span>{needs} need{needs === 1 ? 's' : ''} you</Badge> : <Badge kind="done">Ready to publish</Badge>}
        <span className="flex-1" />
        <span className="shrink-0 text-13 text-author-muted max-[1180px]:sr-only" role="status">{saved}</span>
        {!wide && showKora && <button type="button" className={BUTTON.koraOutline} aria-expanded={kora} onClick={() => setKora(!kora)}>{Icon.chat(14)} Ask Kora</button>}
        <button type="button" className={BUTTON.secondary} onClick={play}>Play a week</button>
        <button type="button" className={BUTTON.primary} onClick={() => navigate({ page: 'workspace', tab: 'publish' })}>Review and publish</button>
      </header>
      {problem && <p role="alert" className="m-0 flex-none bg-author-need-field px-6 py-2 text-14 font-700 text-author-need">{problem} <button type="button" className={BUTTON.link} onClick={() => navigate({ page: 'workspace', tab: 'publish' })}>See the checks</button></p>}
      <div className={`relative grid min-h-0 flex-1 ${tablet ? 'grid-cols-1 grid-rows-[auto_minmax(0,1fr)]' : wide && showKora ? 'grid-cols-[15.5rem_minmax(0,1fr)_20rem]' : 'grid-cols-[14rem_minmax(0,1fr)]'}`}>
        {nav}
        <main className="flex min-h-0 min-w-0 flex-col bg-author-canvas">
          <Suspense fallback={<p className="m-0 p-7 text-14 text-author-muted">Loading.</p>}>
            <Page />
          </Suspense>
        </main>
        {showKora && (wide ? <KoraPanel tab={tab} /> : kora && (
          <div className="absolute inset-y-0 end-0 z-30 flex w-[min(22rem,100%)] flex-col shadow-[0_0_30px_rgb(20_26_46/0.2)]">
            <KoraPanel tab={tab} onClose={() => setKora(false)} />
          </div>
        ))}
      </div>
    </div>
  );
}
