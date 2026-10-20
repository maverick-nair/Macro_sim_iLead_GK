import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { BriefMomentsSection, FindingsSection, FullReportNav, LeftOutNote, MondaySection } from './FirstPage';
import { sectionTitle } from './fullReport';
import { StakeholdersSection } from './StakeholdersSection';
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
    case 'stakeholders': return <StakeholdersSection stakeholders={s.stakeholders} />;
  }
}


/** A section of the full report, reachable by its anchor (`#report-skills`) from the contents and from a deep link. */
const anchored = (key: string, node: ReactNode) => <div id={`report-${key}`} tabIndex={-1} className="scroll-mt-20 outline-0">{node}</div>;

/**
 * The report from the engine (`view.report`, D64, D75), web and print, in the storyline's purpose:
 * development or assessment. It opens on a first page that stands alone (D235): the headline and overall
 * level, three findings, three things to do on Monday and the two moments that mattered most; the full
 * report opens below it on demand, and print and the PDF carry both. It is the page's main landmark, so
 * the caller renders it in place of the end screen, not inside another `main`. Download PDF opens the print view (letter pages, a new page
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
  // The full report under the first page (D235), and the section a link or a deep link asked for.
  const [full, setFull] = useState(false);
  const target = useRef<string | null>(null);
  const [asked, setAsked] = useState(0);
  const goTo = (key: string) => { target.current = key; setFull(true); setAsked(n => n + 1); };
  const toolbar = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const money = useMemo(() => moneyFormatter(view.money), [view.money]);
  // The report's contract applies the copy rules to its text (D76).
  const r = useMemo(() => (view.report ? parseReport(view.report) : null), [view.report]);
  const model = useMemo(() => (r ? buildReportModel(i18n, money, r, { participantName, date: dateProp ?? date, subPeriodUnit: view.clock.subPeriodUnit, history }) : null),
    [i18n, money, r, participantName, dateProp, date, view.clock.subPeriodUnit, history]);

  // The full report's anchors: its sections, the team over the run and the summary's rest.
  const anchors = useMemo(() => (model ? [...model.sections.map(s => s.key), 'team'] : []).join(' '), [model]);
  // A deep link to a section of the full report opens it there, on load and when the hash changes.
  useEffect(() => {
    const follow = () => {
      const key = location.hash.startsWith('#report-') ? decodeURIComponent(location.hash.slice('#report-'.length)) : '';
      if (key && anchors.split(' ').includes(key)) goTo(key);
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [anchors]);
  // Once the full report has rendered, go to the section asked for and move focus there.
  useEffect(() => {
    if (!full || !target.current) return;
    const el = document.getElementById(`report-${target.current}`);
    target.current = null;
    el?.scrollIntoView({ block: 'start' });
    el?.focus({ preventScroll: true });
  }, [full, asked]);

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
        <h1 className="m-0 text-34 font-600">{t('report.unnamed', { purpose: 'development' })}</h1>
        <p className="m-0 text-14 text-fg-secondary">{t('report.notReady')}</p>
      </main>
    );
  }

  // The first page (D235) shares the header's card and page: the summary's verdict, headline and level, then
  // the findings, the things to do and the moments. A report stored before D235 has no brief: its whole
  // summary opens it. Then the full report: web, a card per section, on demand; print, a new page per
  // section (D75), always. The team over the run follows the summary's rest, in its card and page.
  const brief = model.brief;
  const summary = model.sections.find(s => s.key === 'summary');
  const blocks: ReportBlock[] = [{ key: 'header', card: true, node: <ReportHeader {...model.header} /> }];
  if (summary?.key === 'summary') blocks.push({ key: 'summary-first', node: <SummarySection narrative={summary.narrative} extras={summary.extras} part={brief ? 'first' : 'all'} /> });
  if (brief?.findings.length) blocks.push({ key: 'findings', node: <FindingsSection findings={brief.findings} /> });
  if (brief?.actions.length) blocks.push({ key: 'monday', node: <MondaySection actions={brief.actions} /> });
  if (brief?.moments.length) blocks.push({ key: 'moments-first', node: <BriefMomentsSection moments={brief.moments} /> });

  const titled = { purpose: model.purpose, unit: model.unit, periods: model.periods };
  const rest: Array<{ key: string; title: string; node: ReactNode; joined?: boolean }> = [];
  const team = model.team.length ? { key: 'team', title: sectionTitle(t, 'team', titled), node: <TeamOverRun periods={model.periods} unit={model.unit} series={model.team} /> } : null;
  if (!summary && team) rest.push(team);
  for (const s of model.sections) {
    if (s.key !== 'summary') rest.push({ key: s.key, title: sectionTitle(t, s.key, titled), node: sectionNode(s, model.unit, model.periods) });
    else {
      if (brief) rest.push({ key: 'summary', title: t('report.summary.rest'), node: <SummarySection narrative={s.narrative} extras={s.extras} part="rest" /> });
      if (team) rest.push({ ...team, joined: !!brief });
    }
  }
  if (!print && rest.length) {
    blocks.push({ key: 'contents', node: <FullReportNav open={full} onToggle={() => setFull(v => !v)} onGo={goTo}
      contents={rest.map(x => ({ key: x.key, title: x.title }))} controls={`report-${rest[0].key}`} /> });
  }
  if (print || full) {
    for (const x of rest) blocks.push({ key: x.key, card: !x.joined, pageBreak: !x.joined, node: anchored(x.key, x.node) });
    if (model.leftOut.length) blocks.push({ key: 'left-out', node: <LeftOutNote names={model.leftOut} /> });
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
