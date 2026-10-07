import type { Outcome, Scenario } from '../data/types';
import type { GroupReportInput } from '../engine/groupContract';
import type { HistoryEntry } from '../engine/reportContract';
import { ApiError, type IleadApi, type Leaderboard, type SessionSnapshot } from './types';

/**
 * JSON over HTTP adapter. Endpoint paths are a proposal until the backend
 * contract is final; keep them in this one file.
 */
export function createHttpApi(baseUrl: string, opts: { getToken?: () => string | null } = {}): IleadApi {
  const base = baseUrl.replace(/\/$/, '');

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = opts.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'include' });
    if (!res.ok) throw new ApiError(`${method} ${path} failed with ${res.status}`, res.status);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    getScenario: () => request<Scenario>('GET', '/scenario'),
    getSession: async () => {
      try {
        return await request<SessionSnapshot>('GET', '/session');
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    saveSettings: settings => request('PUT', '/session/settings', settings),
    setStyle: ({ week, memberId, style }) => request('PUT', `/weeks/${week}/styles/${encodeURIComponent(memberId)}`, { style }),
    planAction: input => request('POST', `/weeks/${input.week}/actions`, input),
    submitInteraction: input => request<Outcome>('POST', '/interactions', input),
    endWeek: ({ week }) => request('POST', `/weeks/${week}/end`),
    emailReport: () => request('POST', '/report/email'),
    reportPdf: async () => {
      const token = opts.getToken?.();
      const res = await fetch(`${base}/report.pdf`, { headers: { Accept: 'application/pdf', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: 'include' });
      if (res.status === 404 || res.status === 501) return null;
      if (!res.ok) throw new ApiError(`GET /report.pdf failed with ${res.status}`, res.status);
      return await res.blob();
    },
    getProfile: () => request<{ name: string | null; cohort: string | null }>('GET', '/profile'),
    getLeaderboard: input => request<Leaderboard>('POST', '/cohort/leaderboard', input),
    getTheme: async () => {
      try {
        return await request<unknown>('GET', '/theme');
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    getHistory: async () => {
      try {
        return await request<HistoryEntry[]>('GET', '/history');
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    // A server that stores only run summaries answers `POST /cohort/report` (`GroupReportRequest`) instead, with the same report.
    getGroupReport: async cohortId => {
      try {
        return await request<GroupReportInput>('GET', `/cohort/${encodeURIComponent(cohortId)}/report`);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    }
  };
}
