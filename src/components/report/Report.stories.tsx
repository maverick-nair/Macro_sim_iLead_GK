import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ReactNode } from 'react';
import type { EngineView } from '../../engine/contract';
import { DEFAULT_LENS_VIEW, NEEDS } from '../../engine/lens';
import { DEFAULT_LENS } from '../../engine/lensLibrary';
import { playToEnd } from '../../engine/mock';
import { playStrategy, type Strategy } from '../../engine/sim/strategies';
import { REPORT_FIXTURE as FX } from '../../data/reportFixture';
import { BusinessSection } from './BusinessSection';
import { ReportProvider, type ReportSettings } from './context';
import { EngineReport, sectionNode } from './EngineReport';
import { buildReportModel, type SectionModel } from './engine';
import { parseStoryline, type StorylineInput } from '../../engine/config';
import { moneyFormatter } from '../../engine/money';
import { parseReport, type HistoryEntry } from '../../engine/reportContract';
import salesElevator from '../../engine/storylines/sales-elevator.json';
import { withSixStyles } from '../../engine/storylines/sixStyles';
import { useI18n } from '../../i18n';
import { LensProvider } from '../style/lens';
import { IntentSection, PairSection, PlanSection } from './IntentPlan';
import { MomentsSection } from './MomentsSection';
import { AnalyticsSection, MethodologySection } from './NotesSections';
import { PeopleSection } from './PeopleSection';
import { ReportHeader } from './ReportHeader';
import { SkillsSection } from './SkillsSection';
import { StyleFitSection } from './StyleFitSection';
import { SummarySection } from './SummarySection';
import { TeamOverRun } from './TeamOverRun';

const meta: Meta = { title: 'Report/Development report', parameters: { layout: 'fullscreen' } };
export default meta;

const noop = () => {};
const MEMBERS = ['Kent Goldberg', 'Beth Killiney', 'Mandy Lobert', 'Peter Higgins', 'Green Bell', 'Lowe Rex'];

/** A report card, as the web view shows each section. */
function Card({ children, settings }: { children: ReactNode; settings?: Partial<ReportSettings> }) {
  return (
    <ReportProvider value={{ print: false, tables: 'toggle', ...settings }}>
      <div className="mx-auto flex max-w-(--il-report-width) flex-col gap-7 rounded-28 border border-line-default bg-surface-card p-8">{children}</div>
    </ReportProvider>
  );
}

export const Header: StoryObj = { render: () => <Card><ReportHeader name={FX.name} line={FX.line} tier={FX.tier} score={FX.score} /></Card> };
export const HeaderLongName: StoryObj = { render: () => <Card><ReportHeader name="Maximiliana Oyelaran Featherstonehaugh" line="Sales Elevator · Innov8 Elevators · October 2026" tier={null} score="0" /></Card> };

/** The design's opening paragraph, then the engine's summary: level, strengths, priorities and the business line. */
export const Summary: StoryObj = {
  render: () => (
    <Card>
      <SummarySection narrative={FX.lede} />
      <SummarySection narrative="You lead people well and adapt to what they need." extras={{ level: 'Advanced', strengths: ['Handling difficult conversations', 'Results ownership', 'Situational flexibility'], priorities: ['Coaching for growth', 'Goal setting and accountability'], business: 'You reached 112% of the $240,000 target with 8 deals; Conversion was the bottleneck in 2 of 8 weeks.',
        headline: 'Your team grew and the numbers followed.',
        lines: ['Over the run your team\'s averages moved: trust +28, result +21 and skill +9.', '92% of your style choices fit what people needed.', 'Next step: notice what you did that worked, and do it on purpose with your real team.'],
        drivers: [
          { key: 'a', tone: 'positive', text: 'Coach member with Peter in weeks 2 and 4 lifted Peter\'s result by 18 (skill +12).' },
          { key: 'b', tone: 'negative', text: 'Conversion was the bottleneck in 2 of 8 weeks: Mandy, who owns it, ended with morale at 52.' }
        ] }} />
    </Card>
  )
};
export const SummaryNoLevel: StoryObj = {
  render: () => <Card><SummarySection narrative={null} extras={{ level: null, strengths: [], priorities: [], business: 'You reached 41% of the $240,000 target with 2 deals.' }} /></Card>
};

export const TeamOverTheRun: StoryObj = { render: () => <Card><TeamOverRun periods={8} unit="week" series={FX.series} /></Card> };

export const SkillsDesign: StoryObj = { render: () => <Card><SkillsSection rows={FX.skills} levels={FX.levels} /></Card> };
/** The engine's five levels, a capped skill and a skill without enough evidence. */
export const SkillsEngine: StoryObj = {
  render: () => (
    <Card>
      <SkillsSection levels={['Novice', 'Developing', 'Proficient', 'Advanced', 'Role Model']} rows={[
        { key: 'a', name: 'Situational flexibility', level: { index: 3, name: 'Advanced' }, quote: { text: 'What do you think we should change?', when: 'Week 8, Meet face to face with Mandy' }, more: { anchor: 'Reads people early and changes approach as their needs change.', observations: 28, capped: false, quotes: [{ text: 'I understand, that sounds hard.', when: 'Week 7, Reply with Kent' }] } },
        { key: 'b', name: 'Giving feedback', level: { index: 1, name: 'Developing' }, quote: null, more: { anchor: 'Gives general feedback without examples.', observations: 4, capped: true, quotes: [] } },
        { key: 'c', name: 'Communicating change', level: null, quote: null, more: { anchor: null, observations: 1, capped: false, quotes: [] } }
      ]} />
    </Card>
  )
};

const fitRows = FX.fit(MEMBERS.map(n => ({ id: n.split(' ')[0].toLowerCase() }))).map((cells, i) => ({ id: String(i), name: MEMBERS[i], fullName: MEMBERS[i], left: i === 5, cells: i === 5 ? cells.map((c, w) => (w > 4 ? null : c)) : cells }));
export const StyleFitDesign: StoryObj = { render: () => <Card settings={{ tables: 'hidden' }}><StyleFitSection unit="week" periods={[1, 2, 3, 4, 5, 6, 7, 8]} rows={fitRows} summary={FX.fitSummary} /></Card> };
/** With the engine's style shares, capability and the used vs needed grid, each with Show as table. */
export const StyleFitEngine: StoryObj = {
  render: () => (
    <Card>
      <StyleFitSection unit="week" periods={[1, 2, 3, 4, 5, 6, 7, 8]} rows={fitRows} summary="You matched 31 of 48 choices."
        extras={{ shares: { D: 29, G: 13, P: 36, E: 22 }, total: 100, dominant: ['P'], capability: 69, grid: [[20, 4, 2, 0], [5, 6, 3, 1], [2, 2, 25, 4], [2, 1, 6, 17]],
          fit: NEEDS.map(n => DEFAULT_LENS.styles.map(s => DEFAULT_LENS.fit[n][s.key])), styles: DEFAULT_LENS_VIEW.styles, needs: DEFAULT_LENS_VIEW.needs, narrative: ['You matched what people needed a good part of the time. The misses cluster around a few people; look at them first.'] }} />
    </Card>
  )
};

export const IntentAndPlanDesign: StoryObj = {
  render: () => (
    <Card>
      <PairSection>
        <IntentSection cards={FX.intent} alone={false} />
        <PlanSection items={FX.plan} reflection={FX.reflection} alone={false} />
      </PairSection>
    </Card>
  )
};
export const IntentEngine: StoryObj = {
  render: () => (
    <Card>
      <IntentSection cards={[
        { key: 'k', name: 'Kent Goldberg', said: 'Kent is experienced but hurt. Less telling, more listening.', did: 'You set Partnering most weeks; in conversations you came across as Directing.', verdict: 'Action did not match intent', tone: 'attention', quote: { text: 'Here is the plan, step by step.', when: 'Week 3, Meet face to face with Kent' }, cost: 'Trust −4 from mixed signals' },
        { key: 'p', name: 'Peter Higgins', said: null, did: 'You set Directing most weeks; in conversations you came across as Directing.', verdict: 'Action matched intent', tone: 'gain' },
        { key: 'b', name: 'Beth Killiney', said: null, did: 'You set Guiding most weeks, and no conversation showed your style yet.', verdict: 'No evidence from a conversation yet', tone: 'neutral' }
      ]} />
    </Card>
  )
};
export const PlanEngine: StoryObj = {
  render: () => (
    <Card>
      <PlanSection reflection="Listen before fixing." checkIn="Check in on October 19, 2026" items={[
        { key: 'c', skill: 'Coaching for growth', text: 'Practise a coaching conversation that asks three questions before offering any fix.', onTheJob: 'In every 1:1 this week, ask one open question before you give an answer.', enoughEvidence: true },
        { key: 'f', skill: 'Giving feedback', text: 'Write feedback for one person with a specific example and the change you want.', onTheJob: 'Give one piece of specific feedback a day.', enoughEvidence: false }
      ]} />
    </Card>
  )
};

export const KeyMoments: StoryObj = {
  render: () => (
    <Card>
      <MomentsSection moments={[
        { key: '1', kind: 'best', when: 'Week 2', title: 'Meet face to face with Kent went well', situation: 'Week 2. Kent needed a conversation.', behaviour: 'You chose Meet face to face and came across as Partnering.', quote: 'What would make this feel fair to you?', impact: 'Kent trust +8, Kent morale +6.', intent: 'Partnering' },
        { key: '2', kind: 'revisit', when: 'Week 4', title: 'Promise broken: Lowe', situation: 'Week 4. You promised Lowe a career talk.', behaviour: 'It waited too long for an answer.', quote: null, impact: 'Lowe trust −6.', intent: null }
      ]} />
      <MomentsSection moments={[]} />
    </Card>
  )
};

const series = (a: number, b: number, c: number) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ label: i ? `W${i}` : 'Start', morale: a + i * 2, trust: b + i * 3, result: c + i }));
export const People: StoryObj = {
  render: () => (
    <Card>
      <PeopleSection people={[
        { id: 'kent', name: 'Kent Goldberg', left: false, points: series(20, 50, 47), actions: 4, days: '4 days', resultChange: 46 },
        { id: 'beth', name: 'Beth Killiney', left: false, points: series(57, 48, 32), actions: 0, days: 'No days', resultChange: 9 },
        { id: 'lowe', name: 'Lowe Rex', left: true, points: series(45, 52, 77).slice(0, 5), actions: 1, days: '1 day', resultChange: -3 }
      ]} />
    </Card>
  )
};

const money = (n: number) => `$${Math.round(n / 1000)}K`;
export const Business: StoryObj = {
  render: () => (
    <Card>
      <BusinessSection unit="week" periods={8} data={{
        line: 'You reached 94% of the $240,000 target with 7 deals; Proposal was the bottleneck in 3 of 8 weeks.', money, conversions: 7,
        revenue: [18, 41, 70, 101, 134, 166, 198, 226].map((v, i) => ({ label: `W${i + 1}`, value: v * 1000, pace: (i + 1) * 30000 })),
        funnel: [['leads', 'Leads', 466, 495], ['qualify', 'Qualify', 188, 206], ['proposal', 'Proposal', 31, 51], ['negotiation', 'Negotiation', 15, 21], ['conversion', 'Conversion', 7, 9]].map(([key, name, value, ideal]) => ({ key: String(key), name: String(name), value: Number(value), ideal: Number(ideal), bottleneck: key === 'proposal' })),
        bottleneck: { name: 'Proposal', periods: 3, why: 'Ruth owns the stage with the lowest result there; morale is 41, the weakest of her numbers.' }
      }} />
    </Card>
  )
};
export const Analytics: StoryObj = { render: () => <Card><AnalyticsSection data={{ conversations: 30, talkRatio: 4.3, openQuestions: 42, recognition: 14, spoken: 6 }} /><AnalyticsSection data={{ conversations: 2, talkRatio: null, openQuestions: 0, recognition: 0, spoken: 0 }} /></Card> };
export const Methodology: StoryObj = { render: () => <Card><MethodologySection data={{ lines: ['This report comes from what you said and did in the simulation.', 'Your game score never changes a skill rating.'], reviewed: false, conversations: 30, observations: 76 }} /></Card> };

type Purpose = 'development' | 'assessment';
/** Sales Elevator, or the six styles lens, in a purpose (D75). */
function storyline(purpose: Purpose = 'development', lens?: 'six_styles') {
  const base = lens ? withSixStyles(salesElevator as unknown as StorylineInput) : salesElevator;
  const r = parseStoryline({ ...base, purpose });
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.config;
}

/** The whole engine report from a real run (Sales Elevator), played by an automated player. */
function FromRun({ policy, seed, print, lens, purpose, history }: { policy: 'good' | 'random' | 'passive'; seed: number; print?: boolean; lens?: 'six_styles'; purpose?: Purpose; history?: boolean }) {
  const [view, setView] = useState<EngineView | null>(null);
  useEffect(() => {
    void playToEnd({ policy, seed, config: lens || purpose ? storyline(purpose, lens) : undefined, reflection: policy === 'good' ? ['Kent taught me that the loudest problem is not always the real one.'] : undefined }).then(setView);
  }, [policy, seed, lens, purpose]);
  const getHistory = history ? async () => {
    const earlier = await playToEnd({ policy: 'random', seed: 11, config: storyline(purpose, lens) });
    const r = earlier.report as { run: unknown; summary: { level: { name: string } | null } };
    return [{ attempt: 1, endedAt: '2026-09-21', headline: r.summary.level?.name ?? 'Not enough evidence for an overall level', summary: r.run }];
  } : undefined;
  return <div className="flex min-h-screen flex-col">{view && <EngineReport view={view} onBack={noop} print={print} participantName="Jordan Lee" date={new Date(2026, 9, 5)} getHistory={getHistory} />}</div>;
}

/**
 * One report 3.0 section from a real run, in a purpose: the engine's numbers and the purpose's narrative
 * bank, shaped by the same model as the full report.
 */
function SectionFromRun({ section, purpose = 'development', lens, policy = 'random', history }: { section: SectionModel['key']; purpose?: Purpose; lens?: 'six_styles'; policy?: 'good' | 'random'; history?: boolean }) {
  const i18n = useI18n();
  const [view, setView] = useState<EngineView | null>(null);
  const [earlier, setEarlier] = useState<HistoryEntry[] | null>(null);
  useEffect(() => {
    void playToEnd({ policy, seed: 5, config: storyline(purpose, lens) }).then(setView);
    if (history) void playToEnd({ policy: 'good', seed: 2, config: storyline(purpose, lens) }).then(v => {
      const r = parseReport(v.report);
      setEarlier([{ attempt: 1, endedAt: '2026-09-21', headline: r.verdict?.overall.label ?? r.summary.level?.name ?? '', summary: r.run }]);
    });
  }, [purpose, lens, policy, history]);
  if (!view || (history && !earlier)) return null;
  const report = parseReport(view.report);
  const model = buildReportModel(i18n, moneyFormatter(view.money), report, { participantName: 'Jordan Lee', date: new Date(2026, 9, 5), subPeriodUnit: 'day', history: earlier });
  const s = model.sections.find(x => x.key === section);
  return (
    <LensProvider lens={report.lens}>
      <Card settings={{ purpose }}>{s ? sectionNode(s, model.unit, model.periods) : null}</Card>
    </LensProvider>
  );
}

const both = (section: SectionModel['key'], extra: { lens?: 'six_styles'; history?: boolean } = {}): [StoryObj, StoryObj] => [
  { render: () => <SectionFromRun section={section} {...extra} /> },
  { render: () => <SectionFromRun section={section} purpose="assessment" {...extra} /> }
];

export const [About, AboutAssessment] = both('about');
/** Assessment leads with the overall verdict, its bar, evidence and review status. */
export const [SummaryFromRun, SummaryVerdict] = both('summary');
/** Skills with a score out of 10, what each means and its narrative; assessment adds each skill's verdict. */
export const [Skills3, Skills3Assessment] = both('skills');
export const [Objectives, ObjectivesAssessment] = both('objectives');
export const [Adaptability, AdaptabilityAssessment] = both('adaptability');
export const [Styles, StylesAssessment] = both('styles');
/** The Six Leadership Styles lens, which plays five styles (D70, D104): proportion and accuracy for five, the needs by five styles. */
export const [StylesSixStyles, StylesSixStylesAssessment] = both('styles', { lens: 'six_styles' });
export const [Consistency, ConsistencyAssessment] = both('consistency');
export const [Actions, ActionsAssessment] = both('actions');
/** The member by action matrix, filled by impact with a legend in words; Show as table gives the real table. */
export const [Distribution, DistributionAssessment] = both('distribution');
export const [FoodForThought, FoodForThoughtAssessment] = both('thought');
export const [Takeaways, TakeawaysAssessment] = both('takeaways');
/** Development: practice per skill, the 90 day path and check ins. Assessment: development needs, listed neutrally. */
export const [Plan3, Plan3Assessment] = both('plan');
/** With one earlier attempt (`getHistory`). */
export const [Progress, ProgressAssessment] = both('progress', { history: true });

/**
 * The four contrasting runs of the report audit (D143 to D145), scripted: each gets the headline and
 * summary its evidence gives, and its own "What drove your results".
 */
function FromStrategy({ strategy, section, purpose = 'development' }: { strategy: Strategy; section: SectionModel['key']; purpose?: Purpose }) {
  const i18n = useI18n();
  const [view, setView] = useState<EngineView | null>(null);
  useEffect(() => { void playStrategy(storyline(purpose), strategy, 1).then(r => setView(r.view as EngineView)); }, [strategy, purpose]);
  if (!view) return null;
  const report = parseReport(view.report);
  const model = buildReportModel(i18n, moneyFormatter(view.money), report, { participantName: 'Jordan Lee', date: new Date(2026, 9, 5), subPeriodUnit: 'day' });
  const s = model.sections.find(x => x.key === section);
  return <LensProvider lens={report.lens}><Card settings={{ purpose }}>{s ? sectionNode(s, model.unit, model.periods) : null}</Card></LensProvider>;
}
/** People first: fitting styles, coaching the weakest, every message answered. */
export const SummaryPeopleFirstCoach: StoryObj = { render: () => <FromStrategy strategy="coach" section="summary" /> };
/** Results first: everyone directed, goals and blunt words. */
export const SummaryResultsDriver: StoryObj = { render: () => <FromStrategy strategy="driver" section="summary" /> };
/** Reads every person correctly, then takes no action. */
export const SummaryReadsThenWaits: StoryObj = { render: () => <FromStrategy strategy="bystander" section="summary" /> };
/** Warm words with the style that fits least. */
export const SummaryWarmWordsWrongStyles: StoryObj = { render: () => <FromStrategy strategy="warmMismatch" section="summary" /> };
export const SummaryWarmWordsWrongStylesAssessment: StoryObj = { render: () => <FromStrategy strategy="warmMismatch" section="summary" purpose="assessment" /> };
/** Situational flexibility capped by the style choices, with the line that says why (D144). */
export const SkillsReconciled: StoryObj = { render: () => <FromStrategy strategy="warmMismatch" section="skills" /> };
/** Food for thought naming the people and weeks of the run (D145). */
export const FoodForThoughtReadsThenWaits: StoryObj = { render: () => <FromStrategy strategy="bystander" section="thought" /> };

export const FromRunGood: StoryObj = { render: () => <FromRun policy="good" seed={3} /> };
export const FromRunRandom: StoryObj = { render: () => <FromRun policy="random" seed={5} /> };
/** No live conversations: no overall level, every skill without enough evidence. */
export const FromRunPassive: StoryObj = { render: () => <FromRun policy="passive" seed={2} /> };
export const FromRunPrint: StoryObj = { render: () => <FromRun policy="good" seed={3} print /> };
/** Tablet size, 834 wide (D69): the web view, its columns narrower. */
export const FromRunTablet: StoryObj = { render: () => <div style={{ width: 834 }}><FromRun policy="random" seed={5} /></div> };
export const FromRunLight: StoryObj = { globals: { theme: 'light' }, render: () => <FromRun policy="good" seed={3} /> };
/** The Six Leadership Styles lens (D70, D104): five styles in the shares and the grid, the needs as rows, two Report only skills, the lens in the methodology. */
export const FromRunSixStyles: StoryObj = { render: () => <FromRun policy="good" seed={3} lens="six_styles" /> };
/** An assessment report: verdicts first, neutral findings, development needs (D75). */
export const FromRunAssessment: StoryObj = { render: () => <FromRun policy="random" seed={5} purpose="assessment" /> };
export const FromRunAssessmentPrint: StoryObj = { render: () => <FromRun policy="random" seed={5} purpose="assessment" print /> };
/** With an earlier attempt: the progress section shows. */
export const FromRunWithHistory: StoryObj = { render: () => <FromRun policy="good" seed={3} history /> };
