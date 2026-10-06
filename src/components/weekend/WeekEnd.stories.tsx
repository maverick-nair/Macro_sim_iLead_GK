import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ReactNode } from 'react';
import { EngineView } from '../../engine/contract';
import { defaultStoryline } from '../../engine/mock';
import { play } from '../../engine/sim/policies';
import { WEEKEND_FIXTURE as FX } from '../../data/fixtures';
import { DEFAULT_SCENARIO } from '../../data/scenario';
import { EngineWeekEnd } from '../board/EngineWeekEnd';
import { BadgeAward } from '../gamification/Badge';
import { badgeIcon, BADGE_ICON_RULES } from './badgeIcons';
import { WeekEndFlow, type WeekEndFlowProps } from './WeekEndFlow';

const noop = () => {};

const Frame = ({ children }: { children: ReactNode }) => <div style={{ width: 1440, minHeight: 900, display: 'flex', flexDirection: 'column' }}>{children}</div>;

/** The design fixture, as the `/screens` frames w1 to w5 show it. */
const DESIGN: WeekEndFlowProps = {
  period: FX.period, periods: FX.periods, periodUnit: 'week', subPeriodUnit: 'day',
  headline: FX.headline, line: FX.line, stars: FX.stars,
  report: {
    funnel: { stages: DEFAULT_SCENARIO.stages.map(s => ({ key: s.k, name: s.n, value: s.count, ideal: s.ideal })), scale: FX.funnelScale, bottleneck: FX.bottleneck },
    kpis: FX.kpis, stars: FX.starRows, streak: FX.streak, sponsor: FX.sponsor, pulse: FX.pulse
  },
  badges: [FX.badge],
  unlock: { sponsorFirstName: FX.sponsorFirstName, rewards: FX.rewards },
  news: FX.news,
  newsArtLabel: FX.newsArtLabel,
  onChooseReward: () => true,
  onFinish: noop
};

const meta: Meta<typeof WeekEndFlow> = {
  title: 'Components/Week end', component: WeekEndFlow, args: DESIGN,
  decorators: [S => <Frame><S /></Frame>]
};
export default meta;
type Story = StoryObj<typeof WeekEndFlow>;

/** w1: the banner, the engine's headline, stars and line. */
export const Banner: Story = {};
/** w2: the weekly report from the design fixture. */
export const Report: Story = { args: { initial: { step: 'report' } } };
/** The report with the sponsor's confidence below the check in line, and no stars. */
export const ReportCheckIn: Story = {
  args: {
    initial: { step: 'report' }, stars: 0,
    report: { ...DESIGN.report, stars: FX.starRows.map(s => ({ ...s, earned: false })), sponsor: { from: 'wavering', to: 'low', values: { from: 34, to: 24 } }, checkIn: { sponsorName: 'Priya', line: 30 } }
  }
};
/** w3: one badge of one. */
export const Badge: Story = { args: { initial: { step: 'badge' } } };
/** The second of three badges, with their own icons. */
export const BadgeTwoOfThree: Story = {
  args: {
    initial: { step: 'badge', badge: 1 },
    badges: [
      { key: 'read_the_room', rule: 'read_the_room', name: 'Read the Room', reason: '10 of 10 people got the style they needed this week.' },
      { key: 'flex_master', rule: 'flex_master', name: 'Flex Master', reason: 'You used every style at the right moment at least twice.' },
      { key: 'first_close', rule: 'first_close', name: 'First Close', reason: 'Your team closed its first deal.' }
    ]
  }
};
/** w4: the unlock offer, nothing chosen yet. */
export const Unlock: Story = { args: { initial: { step: 'unlock' } } };
/** The unlock offer with a reward chosen: the card rises. */
export const UnlockChosen: Story = { args: { initial: { step: 'unlock', reward: 1 } } };
/** w5: the first of two bulletins. */
export const News: Story = { args: { initial: { step: 'news' } } };
/** The last bulletin with its impact shown and the button that starts the next week. */
export const NewsImpact: Story = { args: { initial: { step: 'news', news: 1, impact: true } } };
/** A bulletin with no impact to show: no See impact link. A crisis card gets the warm art. */
export const NewsNoImpact: Story = {
  args: { initial: { step: 'news' }, news: [{ key: 'storm', card: 'crisis', title: 'A storm closed the office', body: 'Everyone works from home for two days.', impact: null }], newsArtLabel: undefined }
};

/** Every badge rule's icon in the award medal. */
export const BadgeIcons: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {BADGE_ICON_RULES.map(rule => <BadgeAward key={rule} name={rule} reason="Icon for this badge rule." icon={badgeIcon(rule)} index={1} total={1} onSkip={noop} onContinue={noop} />)}
    </div>
  )
};

type RunAt = { period: number; ended?: boolean; reward?: boolean; initial?: WeekEndFlowProps['initial'] };

/** A view from a real run of the good policy (Sales Elevator, seed 3), opened at the end of a period. */
function FromRun({ period, ended, reward, initial }: RunAt) {
  const [view, setView] = useState<EngineView | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await play(defaultStoryline(), 'good', 3);
      const v = EngineView.parse(r.view);
      if (ended) { setView(v); return; }
      const periods = v.periods.slice(0, period);
      const keys = ['bonus_day', 'hire_budget', 'team_activity'];
      if (reward) periods[period - 1] = { ...periods[period - 1], unlockOffer: keys };
      setView({ ...v, phase: 'periodEnd', clock: { ...v.clock, period }, periods, pendingReward: reward ? keys : null });
    })();
  }, [period, ended, reward]);
  return view ? <EngineWeekEnd view={view} initial={initial} busy={false} send={async () => true} onResults={noop} /> : null;
}

/** Week 1 of a real run: two badges (Read the Room, Flex Master), one news bulletin. */
export const FromRunWeek1: StoryObj = { render: () => <Frame><FromRun period={1} /></Frame> };
/** The report for week 2 of a real run: funnel against ideal, with This week and So far. */
export const FromRunReport: StoryObj = { render: () => <Frame><FromRun period={2} initial={{ step: 'report' }} /></Frame> };
/** The first new badge in week 1 of a real run. */
export const FromRunBadge: StoryObj = { render: () => <Frame><FromRun period={1} initial={{ step: 'badge' }} /></Frame> };
/** The next week's news in week 1 of a real run. */
export const FromRunNews: StoryObj = { render: () => <Frame><FromRun period={1} initial={{ step: 'news' }} /></Frame> };
/** Week 3 of a real run: the streak bonus and a CEO check in. */
export const FromRunWeek3CheckIn: StoryObj = { render: () => <Frame><FromRun period={3} /></Frame> };
/** Week 4 of a real run with the unlock offer: the three GenieKreator rewards. */
export const FromRunUnlock: StoryObj = { render: () => <Frame><FromRun period={4} reward initial={{ step: 'unlock' }} /></Frame> };
/** The end of a real run: banner, report and badges, then See your results. */
export const FromRunEnded: StoryObj = { render: () => <Frame><FromRun period={8} ended /></Frame> };

/** The week end report at 834 on a portrait tablet (D73): one column. */
export const TabletPortrait: StoryObj = { decorators: [S => <div data-tablet="" style={{ width: 834 }}><S /></div>] };
