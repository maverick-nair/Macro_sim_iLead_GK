import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ReactNode } from 'react';
import { mockGroupReport, type MockGroupOptions } from '../api/mockGroup';
import { ReportProvider } from '../components/report/context';
import { AboutSection } from '../components/report/AboutSection';
import { parseGroupReport, type GroupReport } from '../engine/groupContract';
import { moneyFormatter } from '../engine/money';
import { GroupReportView } from './GroupReportView';
import {
  ActionsSection, AdaptabilitySection, AttentionSection, BusinessSection, CompletionSection, ConsistencySection, DistributionSection,
  FunnelSection, GroupCover, SkillsSection, StylesSection, TakeawaysSection, VerdictsSection, WithheldNotice
} from './sections';

const meta: Meta = { title: 'Report/Group report', parameters: { layout: 'fullscreen' } };
export default meta;

/** Mock cohorts played by the AI players (D77), smaller than /group's so stories open quickly; one per option set. */
const cache = new Map<string, Promise<GroupReport>>();
function load(opts: MockGroupOptions) {
  const key = JSON.stringify(opts);
  if (!cache.has(key)) cache.set(key, mockGroupReport('story', opts).then(parseGroupReport));
  return cache.get(key)!;
}
const DEV: MockGroupOptions = { size: 12 };
const ASSESS: MockGroupOptions = { purpose: 'assessment', size: 9 };
const SIX: MockGroupOptions = { size: 12, lens: 'six_styles' };

function Loaded({ opts, children }: { opts: MockGroupOptions; children: (r: GroupReport) => ReactNode }) {
  const [report, setReport] = useState<GroupReport | null>(null);
  useEffect(() => { void load(opts).then(setReport); }, [opts]);
  return report ? <>{children(report)}</> : <p className="p-8 text-14 text-fg-secondary">Playing the mock cohort</p>;
}

/** A report card, as the web view shows each section. */
function Card({ opts = DEV, print = false, children }: { opts?: MockGroupOptions; print?: boolean; children: (r: GroupReport) => ReactNode }) {
  return (
    <Loaded opts={opts}>
      {r => (
        <ReportProvider value={{ print, tables: 'toggle', purpose: r.cohort.purpose }}>
          <div className="mx-auto my-6 flex max-w-(--il-report-width) flex-col gap-7 rounded-28 border border-line-default bg-surface-card p-8">{children(r)}</div>
        </ReportProvider>
      )}
    </Loaded>
  );
}
const money = (r: GroupReport) => moneyFormatter(r.money).format;

export const Cover: StoryObj = { render: () => <Card>{r => <><GroupCover report={r} /><AboutSection data={r.about} /></>}</Card> };
export const Withheld: StoryObj = { render: () => <Card opts={{ size: 3 }}>{r => <><GroupCover report={r} /><WithheldNotice message={r.withheld!.message} /></>}</Card> };
export const Verdicts: StoryObj = { render: () => <Card opts={ASSESS}>{r => <VerdictsSection data={r.assessment!} />}</Card> };
export const Skills: StoryObj = { render: () => <Card>{r => <SkillsSection data={r.skills!} participants={r.completed} />}</Card> };
export const SkillDistribution: StoryObj = { render: () => <Card>{r => <DistributionSection data={r.skills!} />}</Card> };
export const Completion: StoryObj = { render: () => <Card>{r => <CompletionSection data={r.completion!} />}</Card> };
export const Business: StoryObj = { render: () => <Card>{r => <BusinessSection data={r.business!} money={money(r)} />}</Card> };
export const Adaptability: StoryObj = { render: () => <Card>{r => <AdaptabilitySection data={r.styles!} />}</Card> };
export const Styles: StoryObj = { render: () => <Card>{r => <StylesSection data={r.styles!} />}</Card> };
export const StylesSixLens: StoryObj = { render: () => <Card opts={SIX}>{r => <><AdaptabilitySection data={r.styles!} /><StylesSection data={r.styles!} /></>}</Card> };
export const Consistency: StoryObj = { render: () => <Card>{r => <ConsistencySection data={r.consistency!} />}</Card> };
export const Funnel: StoryObj = { render: () => <Card>{r => <FunnelSection data={r.funnel!} unit={r.periodUnit} />}</Card> };
export const Actions: StoryObj = { render: () => <Card>{r => <ActionsSection data={r.actions!} />}</Card> };
export const ManagementStyle: StoryObj = { render: () => <Card>{r => <AttentionSection data={r.attention!} />}</Card> };
export const Takeaways: StoryObj = { render: () => <Card>{r => <TakeawaysSection data={r.takeaways} />}</Card> };
/** Print shows tables where charts would not read: the skill distribution and the deviations. */
export const PrintTables: StoryObj = { render: () => <Card print>{r => <><DistributionSection data={r.skills!} /><ConsistencySection data={r.consistency!} /></>}</Card> };

export const WholeReport: StoryObj = { render: () => <Loaded opts={DEV}>{r => <GroupReportView report={r} />}</Loaded> };
export const WholeReportAssessment: StoryObj = { render: () => <Loaded opts={ASSESS}>{r => <GroupReportView report={r} />}</Loaded> };
export const WholeReportPrint: StoryObj = { render: () => <Loaded opts={ASSESS}>{r => <GroupReportView report={r} print />}</Loaded> };
