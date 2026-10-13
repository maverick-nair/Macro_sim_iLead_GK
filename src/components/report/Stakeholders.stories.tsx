import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { parseStoryline } from '../../engine/config';
import { playToEnd } from '../../engine/mock';
import { moneyFormatter } from '../../engine/money';
import { parseReport } from '../../engine/reportContract';
import clientTrust from '../../engine/storylines/client-trust.json';
import { useI18n } from '../../i18n';
import { LensProvider } from '../style/lens';
import { ReportProvider } from './context';
import { sectionNode } from './EngineReport';
import { buildReportModel } from './engine';
import { StakeholdersSection } from './StakeholdersSection';
import type { StakeholderData } from './types';

const meta: Meta = { title: 'Report/Stakeholders', parameters: { layout: 'fullscreen' } };
export default meta;

function Card({ children }: { children: React.ReactNode }) {
  return (
    <ReportProvider value={{ print: false, tables: 'toggle' }}>
      <div className="mx-auto flex max-w-(--il-report-width) flex-col gap-7 rounded-28 border border-line-default bg-surface-card p-8">{children}</div>
    </ReportProvider>
  );
}

const PRIYA: StakeholderData = {
  key: 'client_lead', name: 'Priya Shah', role: 'Head of Finance Operations, Halcyon Retail, a customer', relationship: 'Relationship: steady at the start, good at the end',
  measures: [{ key: 'trust', name: 'Trust in you', start: 55, end: 71, direction: 'up' }, { key: 'satisfaction', name: 'Satisfaction', start: 55, end: 48, direction: 'down' }],
  interactions: [
    { key: 'a', when: 'Week 2', title: 'Meet with Priya', how: 'It went well', outcome: null, changes: ['Trust +6, satisfaction +6', 'Answered their request in time', 'Customer trust +3'] },
    { key: 'b', when: 'Week 5', title: 'Negotiate with Priya', how: 'It did not land', outcome: null, changes: ['Trust −3, satisfaction −4', 'Customer trust −2'] }
  ],
  moves: ['Week 2: You chose "Hold the price and help them build the business case" for A deep discount to close this week. (trust +5, satisfaction +2)']
};
const HELEN: StakeholderData = {
  key: 'cfo', name: 'Helen Brandt', role: 'Chief Financial Officer, Northwind Cloud, an executive', relationship: 'Relationship: steady at the start, cool at the end',
  measures: [{ key: 'trust', name: 'Trust in you', start: 45, end: 39, direction: 'down' }, { key: 'satisfaction', name: 'Satisfaction', start: 50, end: 38, direction: 'down' }],
  interactions: [{ key: 'c', when: 'Week 4', title: 'Helen wants your cost plan by Thursday', how: 'Their request went unanswered', outcome: null, changes: ['Trust −6, satisfaction −8', 'Sponsor confidence −5'] }],
  moves: []
};

/** Two stakeholders: one relationship that grew with a request answered in time, one that cooled after a request went unanswered. */
export const Fixture: StoryObj = { render: () => <Card><StakeholdersSection stakeholders={[PRIYA, HELEN]} /></Card> };

/** From a real Client Trust run, played by the calibration's good player (it answers every request and engages weekly). */
function FromRun() {
  const i18n = useI18n();
  const [view, setView] = useState<EngineView | null>(null);
  useEffect(() => {
    const p = parseStoryline(clientTrust);
    if (p.ok) void playToEnd({ policy: 'good', seed: 3, config: p.config }).then(setView);
  }, []);
  if (!view) return null;
  const report = parseReport(view.report);
  const model = buildReportModel(i18n, moneyFormatter(view.money), report, { participantName: 'Jordan Lee', date: new Date(2026, 9, 5), subPeriodUnit: 'day' });
  const s = model.sections.find(x => x.key === 'stakeholders');
  return <LensProvider lens={report.lens}><Card>{s ? sectionNode(s, model.unit, model.periods) : null}</Card></LensProvider>;
}
export const FromClientTrust: StoryObj = { render: () => <FromRun /> };
