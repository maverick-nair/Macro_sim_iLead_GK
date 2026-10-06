import { createDefaultApi } from '../api';
import { startTheme } from '../theme/bootstrap';

// The `/group` route's launch: a few lines in the first load, so main.tsx can start the report's request
// while the route's code is still loading (D78).

/** What the route needs from the address: the cohort, the mock's options and the theme. */
export function groupLaunch(search = location.search) {
  const q = new URLSearchParams(search);
  const purpose = q.get('purpose') === 'assessment' ? 'assessment' as const : 'development' as const;
  const size = q.get('size') ? Number(q.get('size')) : null;
  const cohort = q.get('cohort') ?? '3';
  const api = createDefaultApi('group', null, { client: q.get('client'), themeUrl: q.get('themeUrl'), group: { purpose, lens: q.get('lens'), size } });
  return { q, api, cohort };
}

/**
 * Starts the theme and the report's request at once. main.tsx calls it while the route's code is still
 * loading (D78), so the request does not wait for this chunk.
 */
export function startGroup(launch: ReturnType<typeof groupLaunch>) {
  startTheme(() => launch.api.getTheme());
  const report = launch.api.getGroupReport(launch.cohort);
  report.catch(() => undefined);
  return { ...launch, report };
}

