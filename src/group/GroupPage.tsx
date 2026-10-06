import { useEffect, useState, type CSSProperties } from 'react';
import { SmallScreenGate } from '../app/SmallScreenGate';
import { parseGroupReport, type GroupReport } from '../engine/groupContract';
import { I18nProvider, useI18n } from '../i18n';
import { BrandContext } from '../theme/brand';
import { useThemeState } from '../theme/bootstrap';
import type { AppliedTheme } from '../theme/types';
import { GroupReportView } from './GroupReportView';
import { groupLaunch, startGroup } from './launch';
import './messages';

type State = { kind: 'loading' } | { kind: 'ready'; report: GroupReport } | { kind: 'missing' } | { kind: 'failed' };

/**
 * The `/group` route (D75, D77): the organization's group report, loaded lazily by main.tsx so nothing
 * here reaches the participant's first load. `?cohort=<id>` names the cohort (`getGroupReport`, proposed
 * `GET /cohort/{id}/report`). With the mock API: `?purpose=assessment`, `?lens=six_styles`, `?size=3` (a
 * cohort under the minimum size). `?theme=light`, `?client=halden` or `?themeUrl=` theme it like the
 * participant app (D72); `?print=1` opens the print view. Below 744 wide the small screen notice covers it (D69).
 */
export default function GroupPage({ started }: { started?: ReturnType<typeof startGroup> }) {
  // Launch parameters, read once.
  const [{ q, report }] = useState(() => started ?? startGroup(groupLaunch()));
  const { theme: applied } = useThemeState();
  const theme = q.get('theme') === 'light' || (q.get('theme') !== 'dark' && applied?.mode === 'light') ? 'light' : 'dark';
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let alive = true;
    report.then(raw => {
      if (alive) setState(raw ? { kind: 'ready', report: parseGroupReport(raw) } : { kind: 'missing' });
    }, e => {
      console.warn('Group report failed to load', e);
      if (alive) setState({ kind: 'failed' });
    });
    return () => { alive = false; };
  }, [report]);
  return (
    <I18nProvider>
      <BrandContext.Provider value={applied?.brand ?? null}>
        <SmallScreenGate theme={theme} clientTheme={applied}>
          {() => <GroupShell theme={theme} clientTheme={applied} state={state} print={q.get('print') === '1'} />}
        </SmallScreenGate>
      </BrandContext.Provider>
    </I18nProvider>
  );
}

function GroupShell({ theme, clientTheme, state, print }: { theme: 'dark' | 'light'; clientTheme: AppliedTheme | null; state: State; print: boolean }) {
  const { t } = useI18n();
  useEffect(() => { document.title = state.kind === 'ready' ? `${state.report.cohort.name}, ${t('group.documentTitle')}` : t('group.documentTitle'); }, [state, t]);
  const style: CSSProperties = { colorScheme: theme, minHeight: '100vh', background: theme === 'dark' ? 'var(--il-backdrop-office)' : 'var(--il-backdrop-daylight)', ...clientTheme?.vars };
  return (
    <div style={style}>
      <div className="il-theme relative flex flex-col font-sans text-14 leading-(--il-app-leading) text-fg-primary tabular-nums [min-height:inherit]">
        {state.kind === 'ready' ? <GroupReportView report={state.report} print={print} /> : (
          <main className="mx-auto flex w-full max-w-(--il-report-width) flex-1 flex-col items-center justify-center gap-4 px-8 py-10 [min-height:inherit]">
            <span className="bg-(image:--il-fill-brand) bg-clip-text text-28 font-700 tracking-(--il-app-logo-tracking) text-transparent">{t('hud.logo')}</span>
            {state.kind === 'loading' && <div className="h-1.5 w-55 animate-(--il-app-loading-shimmer) rounded-3 bg-(image:--il-app-loading-track) bg-size-(--il-app-loading-track-size)" />}
            <h1 role="status" className="m-0 text-15 font-400 text-fg-secondary">{t(state.kind === 'loading' ? 'group.loading' : state.kind === 'missing' ? 'group.missing' : 'group.failed')}</h1>
          </main>
        )}
      </div>
    </div>
  );
}
