import { useEffect, useState } from 'react';
import { TABS, type Tab } from '../model/draft';

/**
 * /author's own routes (D105): `/author` (the co-creator chat, then First draft ready),
 * `/author/workspace/<tab>` and `/author/library`. Plain history navigation inside the lazy chunk; the
 * server serves index.html for every path (SPA fallback), so each route can be opened directly.
 */
export type Route = { page: 'journey' } | { page: 'workspace'; tab: Tab } | { page: 'library' };

export function parseRoute(pathname: string): Route {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[1] === 'library') return { page: 'library' };
  if (parts[1] === 'workspace') return { page: 'workspace', tab: (TABS as readonly string[]).includes(parts[2] ?? '') ? parts[2] as Tab : 'overview' };
  return { page: 'journey' };
}

export const hrefOf = (r: Route) => (r.page === 'journey' ? '/author' : r.page === 'library' ? '/author/library' : `/author/workspace/${r.tab}`);

const EVENT = 'author:navigate';

export function navigate(r: Route) {
  const href = hrefOf(r) + location.search;
  if (location.pathname + location.search !== href) history.pushState(null, '', href);
  window.dispatchEvent(new Event(EVENT));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.pathname));
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.pathname));
    window.addEventListener('popstate', on);
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener(EVENT, on); };
  }, []);
  return route;
}
