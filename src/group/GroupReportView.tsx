import { useEffect, useMemo, useRef, useState } from 'react';
import { AboutSection } from '../components/report/AboutSection';
import { ReportProvider } from '../components/report/context';
import { ReportDocument } from '../components/report/ReportDocument';
import { ReportToolbar } from '../components/report/ReportToolbar';
import type { ReportBlock } from '../components/report/types';
import type { GroupReport, GroupSection } from '../engine/groupContract';
import { moneyFormatter } from '../engine/money';
import { useI18n } from '../i18n';
import {
  ActionsSection, AdaptabilitySection, AttentionSection, BusinessSection, CompletionSection, ConsistencySection, DistributionSection,
  FunnelSection, GroupCover, SkillsSection, StylesSection, TakeawaysSection, VerdictsSection, WithheldNotice
} from './sections';
import { useProgressive } from '../lib/useAfterPaint';
import './messages';

export interface GroupReportViewProps {
  report: GroupReport;
  /** Open in the print view. */
  print?: boolean;
}

function sectionNode(key: GroupSection, r: GroupReport, money: (n: number) => string) {
  switch (key) {
    case 'about': return <AboutSection data={r.about} />;
    case 'verdicts': return r.assessment && <VerdictsSection data={r.assessment} />;
    case 'skills': return r.skills && <SkillsSection data={r.skills} participants={r.completed} />;
    case 'distribution': return r.skills && <DistributionSection data={r.skills} />;
    case 'completion': return r.completion && <CompletionSection data={r.completion} />;
    case 'business': return r.business && <BusinessSection data={r.business} money={money} />;
    case 'adaptability': return r.styles && <AdaptabilitySection data={r.styles} />;
    case 'styles': return r.styles && <StylesSection data={r.styles} />;
    case 'consistency': return r.consistency && <ConsistencySection data={r.consistency} />;
    case 'funnel': return r.funnel && <FunnelSection data={r.funnel} unit={r.periodUnit} />;
    case 'actions': return r.actions && <ActionsSection data={r.actions} />;
    case 'attention': return r.attention && <AttentionSection data={r.attention} />;
    case 'takeaways': return <TakeawaysSection data={r.takeaways} />;
  }
}

/**
 * The group report (D75, D77), web and print, in the report's design language. It is the page's main
 * landmark. Web: a card per section. Print: letter pages, a new page per section, the cover with the
 * about section; Download PDF opens the print view and the browser's print dialog, where the
 * organization saves a PDF, as the individual report does.
 */
export function GroupReportView({ report, print: printProp = false }: GroupReportViewProps) {
  const { t } = useI18n();
  const [print, setPrint] = useState(printProp);
  const [printing, setPrinting] = useState(false);
  const toolbar = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const money = useMemo(() => moneyFormatter(report.money).format, [report.money]);

  // A new page: focus starts on the cohort's name (the h1), or on the print view's toolbar when it opens there.
  useEffect(() => {
    if (printProp) toolbar.current?.querySelector('button')?.focus();
    else toolbar.current?.closest('main')?.querySelector<HTMLElement>('h1')?.focus();
    // On mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Switching views moves focus to the toolbar of the new view.
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
  // The first render is split (D87): the cover and the first sections at once, the rest once that has
  // painted, in a transition that yields. Print lays out every page at once.
  const sectionCount = report.sections.length + 1 + (report.withheld ? 1 : 0);
  const shown = useProgressive(sectionCount, 3, print || printProp);

  const blocks: ReportBlock[] = [{ key: 'cover', card: true, node: <GroupCover report={report} /> }];
  for (const key of report.sections) {
    const joined = blocks.length === 1;
    blocks.push({ key, card: !joined, pageBreak: !joined, node: sectionNode(key, report, money) });
    if (key === 'about' && report.withheld) blocks.push({ key: 'withheld', node: <WithheldNotice message={report.withheld.message} /> });
  }

  return (
    <ReportProvider value={{ print, tables: 'toggle', purpose: report.cohort.purpose }}>
      <ReportDocument
        landmark
        blocks={blocks.slice(0, shown)}
        pageLabel={n => t('group.page', { n })}
        footer={{ brand: t('group.footer') }}
        toolbar={(
          <div ref={toolbar}>
            {print
              ? <ReportToolbar print onBack={() => go(false)} onDownload={() => window.print()} />
              : <ReportToolbar onDownload={() => { go(true); setPrinting(true); }} />}
          </div>
        )}
      />
    </ReportProvider>
  );
}
