import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { moneyFormatter } from '../../engine/money';
import { History, parseReport, type HistoryEntry } from '../../engine/reportContract';
import { useI18n } from '../../i18n';
import { LensProvider } from '../style/lens';
import { AboutSection } from './AboutSection';
import { ActionsSection, DistributionSection } from './ActionsSections';
import { BusinessSection } from './BusinessSection';
import { ReportProvider } from './context';
import { buildReportModel, type SectionModel } from './engine';
import { IntentSection, PlanSection } from './IntentPlan';
import { MomentsSection } from './MomentsSection';
import { DecisionsSection } from './DecisionsSection';
import { AnalyticsSection, MethodologySection } from './NotesSections';
import { PeopleSection } from './PeopleSection';
import { ProgressSection, TakeawaysSection, ThoughtSection } from './ReflectSections';
import { ReportDocument } from './ReportDocument';
import { ReportHeader } from './ReportHeader';
import { ReportToolbar } from './ReportToolbar';
import { AdaptabilitySection, ObjectivesSection } from './ResultsSections';
import { SkillsSection } from './SkillsSection';
import { StyleFitSection } from './StyleFitSection';
import { ConsistencySection, StylesSection } from './StylesSection';
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
  /** The report date, for the header and the check in dates. Defaults to today. */
  date?: Date;
  /** Emails the report. Leave it out where there is no email service; the button hides. */
  onEmail?: () => void;
  /** A PDF rendered by the server, or null without a PDF service (then the print view and the browser's dialog). */
  getPdf?: () => Promise<Blob | null>;
  /** Earlier attempts (`getHistory`, proposed `GET /history`), or null when there are none. The progress section shows only with some. */
  getHistory?: () => Promise<unknown>;
}

export function sectionNode(s: SectionModel, unit: EngineView['clock']['periodUnit'], periods: number) {
  switch (s.key) {
    case 'about': return <AboutSection data={s.data} />;
    case 'summary': return <SummarySection narrative={s.narrative} extras={s.extras} />;
    case 'skills': return <SkillsSection rows={s.rows} levels={s.levels} />;
    case 'objectives': return <ObjectivesSection data={s.data} />;
    case 'adaptability': return <AdaptabilitySection data={s.data} />;
    case 'styles': return <StylesSection data={s.data} />;
    case 'style': return <StyleFitSection unit={unit} periods={s.periods} rows={s.rows} summary={s.summary} extras={s.extras} />;
    case 'consistency': return <ConsistencySection data={s.data} />;
    case 'intent': return <IntentSection cards={s.cards} />;
    case 'actions': return <ActionsSection rows={s.rows} />;
    case 'distribution': return <DistributionSection data={s.data} />;
    case 'moments': return <MomentsSection moments={s.moments} />;
    case 'decisions': return <DecisionsSection decisions={s.decisions} variables={s.variables} />;
    case 'people': return <PeopleSection people={s.people} />;
    case 'business': return <BusinessSection data={s.data} unit={unit} periods={periods} />;
    case 'analytics': return <AnalyticsSection data={s.data} />;
    case 'thought': return <ThoughtSection data={s.data} />;
    case 'takeaways': return <TakeawaysSection lines={s.lines} />;
    case 'plan': return <PlanSection items={s.items} reflection={s.reflection} checkIn={s.checkIn} extras={s.extras} />;
    case 'progress': return <ProgressSection data={s.data} />;
    case 'methodology': return <MethodologySection data={s.data} />;
  }
}


/**
 * The report from the engine (`view.report`, D64, D75), web and print, in the storyline's purpose:
 * development or assessment. It is the page's main landmark, so the caller renders it in place of the
 * end screen, not inside another `main`. Download PDF opens the print view (letter pages, a new page
 * per section) and the browser's print dialog, where the participant saves a PDF. Load it lazily: it
 * carries visx and the report's schema, which stay out of the first load.
 */
export function EngineReport({ view, onBack, print: printProp = false, participantName, date: dateProp, onEmail, getPdf, getHistory }: EngineReportProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const [print, setPrint] = useState(printProp);
  const [printing, setPrinting] = useState(false);
  const [date] = useState(() => dateProp ?? new Date());
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const money = useMemo(() => moneyFormatter(view.money), [view.money]);
  // The report's contract applies the copy rules to its text (D76).
  const r = useMemo(() => (view.report ? parseReport(view.report) : null), [view.report]);
  const model = useMemo(() => (r ? buildReportModel(i18n, money, r, { participantName, date: dateProp ?? date, subPeriodUnit: view.clock.subPeriodUnit, history }) : null),
    [i18n, money, r, participantName, dateProp, date, view.clock.subPeriodUnit, history]);

  // Earlier attempts, for the progress section. None, or a failed request: the section stays hidden.
  useEffect(() => {
    if (!getHistory) return;
    let alive = true;
    void getHistory().then(raw => {
      const parsed = raw ? History.safeParse(raw) : null;
      if (alive && parsed?.success && parsed.data.length) setHistory(parsed.data);
    }, () => undefined);
    return () => { alive = false; };
    // Asked once per report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    a.download = r?.purpose === 'assessment' ? 'assessment-report.pdf' : 'development-report.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (!model) {
    return (
      <main className="mx-auto flex w-full max-w-(--il-report-width) flex-1 flex-col gap-4 px-8 pt-6 pb-10">
        <ReportToolbar onBack={onBack} />
        <h1 className="m-0 text-34 font-700">{t('report.unnamed', { purpose: 'development' })}</h1>
        <p className="m-0 text-14 text-fg-secondary">{t('report.notReady')}</p>
      </main>
    );
  }

  // Web: a card per section. Print: a new page per section (D75). The first section shares the header's
  // card and page, and the team over the run follows the summary.
  const blocks: ReportBlock[] = [{ key: 'header', card: true, node: <ReportHeader {...model.header} /> }];
  const team: ReportBlock = { key: 'team', node: <TeamOverRun periods={model.periods} unit={model.unit} series={model.team} /> };
  if (!model.sections.some(s => s.key === 'summary') && model.team.length) blocks.push(team);
  for (const s of model.sections) {
    const joined = blocks.length === 1;
    blocks.push({ key: s.key, card: !joined, pageBreak: !joined, node: sectionNode(s, model.unit, model.periods) });
    if (s.key === 'summary' && model.team.length) blocks.push(team);
  }

  return (
    <LensProvider lens={r?.lens ?? view.lens}>
    <ReportProvider value={{ print, tables: 'toggle', purpose: model.purpose }}>
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
    </LensProvider>
  );
}

export default EngineReport;
