import type { ScreenProps } from '../app/types';
import { REPORT_FIXTURE as FX } from '../data/reportFixture';
import { useI18n } from '../i18n';
import { ReportProvider } from '../components/report/context';
import { IntentSection, PairSection, PlanSection } from '../components/report/IntentPlan';
import { ReportDocument } from '../components/report/ReportDocument';
import { ReportHeader } from '../components/report/ReportHeader';
import { ReportToolbar } from '../components/report/ReportToolbar';
import { SkillsSection } from '../components/report/SkillsSection';
import { StyleFitSection } from '../components/report/StyleFitSection';
import { SummarySection } from '../components/report/SummarySection';
import { TeamOverRun } from '../components/report/TeamOverRun';
import type { ReportBlock } from '../components/report/types';
import '../components/report/messages';

/**
 * The prototype's development report (port of `project/ilReport.dc.html`) on the design fixture, for the
 * `/screens` gallery (frames e2 web, e3 print, m7 mobile). It shows only the sections the design drew.
 * The playable app renders the engine's report with the same components (`src/components/report/EngineReport.tsx`).
 */
export interface ReportProps extends ScreenProps {
  print?: boolean;
  mobile?: boolean;
}

export function Report({ d, act, print = false, mobile = false }: ReportProps) {
  const { t } = useI18n();
  const fit = FX.fit(d.members);
  const blocks: ReportBlock[] = [
    { key: 'header', card: true, node: <ReportHeader name={FX.name} line={FX.line} tier={FX.tier} score={FX.score} /> },
    { key: 'summary', node: <SummarySection narrative={FX.lede} /> },
    { key: 'team', node: <TeamOverRun periods={FX.periods} unit="week" series={FX.series} /> },
    { key: 'skills', node: <SkillsSection rows={FX.skills} levels={FX.levels} /> },
    {
      key: 'style', card: true, pageBreak: true,
      node: (
        <StyleFitSection unit="week" periods={[1, 2, 3, 4, 5, 6, 7, 8]} summary={FX.fitSummary}
          rows={d.members.map((m, i) => ({ id: m.id, name: mobile ? m.name.split(' ')[0] : m.name, fullName: m.name, left: false, cells: fit[i] }))} />
      )
    },
    {
      key: 'pair',
      node: (
        <PairSection>
          <IntentSection cards={FX.intent} alone={false} />
          <PlanSection items={FX.plan} reflection={FX.reflection} alone={false} />
        </PairSection>
      )
    }
  ];
  return (
    <ReportProvider value={{ layout: mobile ? 'phone' : 'desktop', print, tables: 'hidden' }}>
      <ReportDocument
        blocks={blocks}
        footer={{ brand: t('report.footer.brand'), last: t('report.footer.shared') }}
        toolbar={print ? undefined : (
          <ReportToolbar onBack={() => act.go('end')} onEmail={() => act.say('Report sent to your work email.')} onDownload={() => act.say('Your PDF report is downloading.')} />
        )}
      />
    </ReportProvider>
  );
}
