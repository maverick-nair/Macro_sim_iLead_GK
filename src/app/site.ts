/**
 * Which product this deployment serves (D238), from `VITE_SITE` at build time: `simulation` (participants only),
 * `geniekreator` (authors), or unset (both, as on a developer's machine). Two hosting projects build the same
 * branch with different values, so each product has its own link.
 */
export type Site = 'simulation' | 'geniekreator' | 'both';

export const siteOf = (value: string | undefined): Site => (value === 'simulation' || value === 'geniekreator' ? value : 'both');

/**
 * Where a first address should go instead, or null to stay. GenieKreator's site opens on /author at its bare root;
 * participant routes stay, because Preview plays the draft on them. The simulation's site has no /author.
 */
export function siteRedirect(site: Site, pathname: string, search: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (site === 'geniekreator' && path === '/' && !search) return '/author';
  if (site === 'simulation' && (path === '/author' || path.startsWith('/author/'))) return '/';
  return null;
}
