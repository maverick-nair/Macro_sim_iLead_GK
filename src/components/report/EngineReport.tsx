import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { moneyFormatter } from '../../engine/money';
import { useI18n } from '../../i18n';
import { BusinessSection } from './BusinessSection';
import { ReportProvider } from './context';
import { buildReportModel, type SectionModel } from './engine';
import { IntentSection, PlanSection } from './IntentPlan';
import { MomentsSection } from './MomentsSection';
import { AnalyticsSection, MethodologySection } from './NotesSections';
import { PeopleSection } from './PeopleSection';
import { ReportDocument } from './ReportDocument';
import { ReportHeader } from './ReportHeader';
import { ReportToolbar } from './ReportToolbar';
import { SkillsSection } from './SkillsSection';
import { StyleFitSection } from './StyleFitSection';
import { SummarySection } from './SummarySection';
import { TeamOverRun } from './TeamOverRun';
import type { ReportBlock } from './types';
import './messages';

export interface EngineReportProps {
  view: EngineView;
  /** Back to the results (the end screen). */
  onBack: () => void;
  /** Open in the print view. */
  print?: boolean;
  /** The participant's name for the h1. Not engine data; the app passes the launch participant id for now. */
  participantName?: string | null;
  /** The report date, for the header and the check in date. Defaults to today. */
  date?: Date;
  /** Emails the report. Leave it out where there is no email service; the button hides. */
  onEmail?: () => void;
  /** A PDF rendered by the server, or null without a PDF service (then the print view and the browser's dialog). */
  getPdf?: () => Promise<Blob | null>;
}

function sectionNode(s: SectionModel, unit: EngineView['clock']['periodUnit'], periods: number) {
  switch (s.key) {
    case 'summary': return <SummarySection narrative={s.narrative} extras={s.extras} />;
    case 'style': return <StyleFitSection unit={unit} periods={s.periods} rows={s.rows} summary={s.summary} extras={s.extras} />;
    case 'intent': return <IntentSection cards={s.cards} />;
    case 'skills': return <SkillsSection rows={s.rows} levels={s.levels} />;
    case 'moments': return <MomentsSection moments={s.moments} />;
    case 'people': return <PeopleSection people={s.people} />;
    case 'business': return <BusinessSection data={s.data} unit={unit} periods={periods} />;
    case 'analytics': return <AnalyticsSection data={s.data} />;
    case 'plan': return <PlanSection items={s.items} reflection={s.reflection} checkIn={s.checkIn} />;
    case 'methodology': return <MethodologySection data={s.data} />;
  }
}

/**
 * The development report from the engine (`view.report`), web and print. It is the page's main landmark,
 * so the caller renders it in place of the end screen, not inside another `main`. Download PDF opens
 * the print view (letter pages) and the browser's print dialog, where the participant saves a PDF.
 * Load it lazily: it carries visx, which stays out of the first load.
 */
export function EngineReport({ view, onBack, print: printProp = false, participantName, date: dateProp, onEmail, getPdf }: EngineReportProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const [print, setPrint] = useState(printProp);
  const [printing, setPrinting] = useState(false);
  const [date] = useState(() => dateProp ?? new Date());
  const toolbar = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const money = useMemo(() => moneyFormatter(view.money), [view.money]);
  const r = view.report;
  const model = useMemo(() => (r ? buildReportModel(i18n, money, r, { participantName, date: dateProp ?? date, subPeriodUnit: view.clock.subPeriodUnit }) : null),
    [i18n, money, r, participantName, dateProp, date, view.clock.subPeriodUnit]);

  // A new screen: focus starts on the name (the h1), or on the print view's toolbar when it opens there.
  useEffect(() => {
    if (printProp) toolbar.current?.querySelector('button')?.focus();
    else toolbar.current?.closest('main')?.querySelector<HTMLElement>('h1')?.focus();
    // On mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switching views moves focus to the toolbar of the new view, so keyboard users keep their place.
  useEffect(() => {
    if (!moved.current) return;
    const buttons = toolbar.current?.querySelectorAll('button') ?? [];
    buttons[print ? 0 : buttons.length - 1]?.focus();
  }, [print]);

  // Print once the print view has been laid out into pages.
  useEffect(() => {
    if (!printing || !print) return;
    const id = requestAnimationFrame(() => { setPrinting(false); window.print(); });
    return () => cancelAnimationFrame(id);
  }, [printing, print]);

  const go = (next: boolean) => { moved.current = true; setPrint(next); };
  // Download PDF: the server's PDF when there is one, else the print view and the browser's print dialog.
  const download = async () => {
    const blob = await getPdf?.().catch(() => null);
    if (!blob) { go(true); setPrinting(true); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'development-report.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (!model) {
    return (
      <main className="mx-auto flex w-full max-w-(--il-report-width) flex-1 flex-col gap-4 px-8 pt-6 pb-10">
        <ReportToolbar onBack={onBack} />
        <h1 className="m-0 text-34 font-700">{t('report.unnamed')}</h1>
        <p className="m-0 text-14 text-fg-secondary">{t('report.notReady')}</p>
      </main>
    );
  }

  const blocks: ReportBlock[] = [{ key: 'header', card: true, node: <ReportHeader {...model.header} /> }];
  const team: ReportBlock = { key: 'team', node: <TeamOverRun periods={model.periods} unit={model.unit} series={model.team} /> };
  if (!model.sections.some(s => s.key === 'summary') && model.team.length) blocks.push(team);
  for (const s of model.sections) {
    blocks.push({ key: s.key, card: s.key !== 'summary', node: sectionNode(s, model.unit, model.periods) });
    if (s.key === 'summary' && model.team.length) blocks.push(team);
  }

  return (
    <ReportProvider value={{ print, tables: 'toggle' }}>
      <ReportDocument
        landmark
        blocks={blocks}
        footer={{ brand: t('report.footer.brand') }}
        toolbar={(
          <div ref={toolbar}>
            {print
              ? <ReportToolbar print onBack={() => go(false)} onDownload={() => window.print()} />
              : <ReportToolbar onBack={onBack} onEmail={onEmail} onDownload={() => void download()} />}
          </div>
        )}
      />
    </ReportProvider>
  );
}

export default EngineReport;
