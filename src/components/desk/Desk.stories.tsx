import type { Meta, StoryObj } from '@storybook/react-vite';
import type { BusinessItem } from '../business/BusinessBar';
import { ScoreBreakdown } from '../gamification/ScoreBreakdown';
import { StageHeader } from '../team/TeamBoard';
import { SignedOut } from '../session/SignedOut';
import { bandModel, type BandView } from './band';
import { DeskCard } from './DeskCard';
import { DeskFeed, type DeskFeedProps } from './DeskFeed';
import { DeskStatus } from './DeskStatus';
import { StatusBand, type StatusBandProps } from './StatusBand';

/**
 * The engine desk after the approved canvas (D211 to D216): the status band, the stage headers with their
 * output, the feedback and inbox feed and the signed out screen. The values stand in for an engine view.
 */
const meta: Meta = { title: 'Board/Desk', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const noop = () => {};
const TIERS = [{ key: 'platinum', name: 'Platinum', min: 850 }, { key: 'gold', name: 'Gold', min: 700 }, { key: 'silver', name: 'Silver', min: 500 }, { key: 'bronze', name: 'Bronze', min: 0 }];
const VIEW = {
  kpis: [{ metric: 'skill', value: 53, start: 52, trend: 'up' }, { metric: 'morale', value: 52, start: 50, trend: 'up' }, { metric: 'result', value: 55, start: 55, trend: 'flat' }, { metric: 'trust', value: 54, start: 51, trend: 'up' }],
  money: { currency: 'USD', locale: 'en-US', display: 'symbol', target: 240000, value: 60000, valueThisPeriod: 12000 },
  clock: { period: 2, periods: 8, periodUnit: 'week', subPeriod: 3, subPeriodUnit: 'day', capacity: 5, capacityLeft: 3, costStep: 0.5, runShare: 0.3125 },
  score: { total: 412, max: 1000, business: 40, people: 52, leadership: 45, capability: 61, live: 58, bonus: 25, tier: null },
  gamification: { weights: { business: 0.3, people: 0.3, leadership: 0.4 }, stars: [40, 60, 80], streak: { length: 2, minStars: 2, bonus: 25, cap: 100 }, tiers: TIERS, leaderboard: { enabled: true, scope: 'cohort', size: 10, anonymous: false }, celebration: 'subtle' },
  periods: [{ period: 1, week: { stars: 2 }, sponsor: { to: 50 } }],
  sponsor: { name: 'Roger Kent', title: 'Chief Executive', img: null, styleLine: '', value: 56, unlockAt: 70, checkInBelow: 30, level: 'steady', causes: [{ text: 'Your report on the Halden deal was candid.', delta: 4 }, { text: 'Two people trained in one week.', delta: 2 }] }
} as unknown as BandView;
const VARS: BusinessItem[] = [
  { key: 'pipeline', name: 'Late pipeline', value: '$210K', dir: 'up', better: true, about: 'The value of deals in Proposal and Negotiation.', causes: [{ text: 'Halden moved to Negotiation', change: '+$40K', dir: 'up' }] },
  { key: 'trust', name: 'Client trust', value: '68%', dir: 'down', better: false, about: 'How much your clients trust the team to keep its promises.', causes: [] }
];
const breakdown = (
  <ScoreBreakdown total={412} max={1000} capability={61} live={58} bonus={25} bonusCap={100} streak="2 weeks in a row. 1 more week for a +25 bonus." tiers={TIERS} tier={null}
    pillars={[{ key: 'business', value: 40, weight: 0.3 }, { key: 'people', value: 52, weight: 0.3 }, { key: 'leadership', value: 45, weight: 0.4 }]} badges={{ earned: 2, total: 9 }} onBadges={noop} />
);
const rank = <button type="button" className="self-start text-13 font-600 underline">Rank 6 of 24</button>;
const band = (over: Partial<BandView> = {}, props: Partial<StatusBandProps> = {}): StatusBandProps => ({
  model: bandModel({ ...VIEW, ...over }), periodUnit: 'week', subPeriodUnit: 'day', targetLabel: '8 week target', business: VARS,
  sponsorName: 'Roger', sponsorCauses: VIEW.sponsor.causes, score: { total: 412 }, breakdown, rank, onOverview: noop, ...props
});
const wide = (w: number) => (S: () => React.ReactNode) => <div style={{ width: w, paddingTop: 16 }}><S /></div>;

/** Behind pace, with the storyline's business variables, last week's stars, the rank and the sponsor between their lines. */
export const Band: Story = { decorators: [wide(1440)], render: () => <StatusBand {...band()} /> };
/** The landscape tablet (1194): the same three groups, tighter. */
export const BandTablet: Story = { decorators: [wide(1194)], render: () => <StatusBand {...band()} /> };
/** Ahead of pace, the reward line reached, no business variables, the leaderboard off. */
export const BandAheadReward: Story = {
  decorators: [wide(1440)],
  render: () => <StatusBand {...band({ money: { ...VIEW.money, value: 90000 }, sponsor: { ...VIEW.sponsor, value: 74 } }, { business: [], rank: undefined })} />
};
/** Week 1: no stars yet, no sponsor change yet, the check in line crossed. */
export const BandWeekOne: Story = {
  decorators: [wide(1440)],
  render: () => <StatusBand {...band({ periods: [], sponsor: { ...VIEW.sponsor, value: 24 }, clock: { ...VIEW.clock, period: 1, runShare: 0.05 } })} />
};
/** The score's breakdown open. */
export const BandBreakdownOpen: Story = { decorators: [S => <div style={{ width: 1440, height: 640, paddingTop: 16 }}><S /></div>], render: () => <StatusBand {...band({}, { scoreOpen: true })} /> };

/** Stage headers with output against the ideal (D216); the bottleneck says so in words and a heavier border. */
export const FunnelHeaders: Story = {
  decorators: [wide(1100)],
  render: () => (
    <div className="grid grid-cols-5 gap-3 px-5">
      {[['Leads', 31, 33, false], ['Qualify', 14, 16, false], ['Proposal', 4, 8, true], ['Negotiation', 3, 4, false], ['Conversion', 2, 2, false]].map(([name, n, ideal, hot]) => (
        <StageHeader key={name as string} name={name as string} count={2} ideal={2} bottleneck={hot as boolean} periodUnit="week" output={{ n: n as number, ideal: ideal as number }}
          about="Turns interest into a written proposal." suits="Writing, pricing" />
      ))}
    </div>
  )
};

const FEED: DeskFeedProps = {
  subPeriodUnit: 'day', onAll: noop,
  feedback: { key: 'f', when: 'Day 2', title: 'Coaching Nalani landed.', changes: [{ label: 'Skill', dir: 'up', n: '3' }, { label: 'Morale', dir: 'up', n: '2' }], more: 0, onWhy: noop },
  milestones: [{ key: 'm', text: 'Your team has earned 25% of the revenue target.', onResults: noop, onLeaderboard: noop, onDismiss: noop }],
  messages: [
    { id: 'a', sender: { kind: 'sponsor', initials: 'RK' }, from: 'Roger Kent', kind: 'sponsor', title: 'How is the team settling in? The honest version.', due: 'Due in 2 days', urgent: true, cta: 'reply', onOpen: noop, onLater: noop },
    { id: 'b', sender: { kind: 'member', img: '/assets/npc/kent.png' }, from: 'Kent Goldberg', kind: 'chat', title: 'Can we talk about the Halden proposal before Friday?', due: null, urgent: false, cta: 'reply', onOpen: noop, onLater: noop },
    { id: 'c', sender: { kind: 'news' }, from: '', kind: 'news', title: 'Recession strikes', due: null, urgent: false, cta: 'read', onOpen: noop }
  ]
};
/** Feedback, a milestone and three messages: the row scrolls sideways when it is full. */
export const Feed: Story = { decorators: [wide(1100)], render: () => <DeskFeed {...FEED} /> };
/** Nothing yet. */
export const FeedEmpty: Story = { decorators: [wide(1100)], render: () => <DeskFeed {...FEED} feedback={null} milestones={[]} messages={[]} /> };

/** Signed out with no return address (D213): where the run stands and the way back. */
export const SignedOutScreen: Story = {
  decorators: [S => <div style={{ width: 1440, height: 900, display: 'flex' }}><S /></div>],
  render: () => <SignedOut at={new Date('2026-10-06T11:06:00').getTime()} where={{ period: 'Week 1', sub: 'Day 3', left: '3 days left' }} score={{ total: 412, tier: 'Bronze' }}
    money={{ label: '8 week target', value: 60000, target: 240000 }} live={{ used: 1, cap: 2 }} onBack={noop} />
};

const card = { title: 'Account Executive', img: '/assets/npc/kent.webp', skill: 53, morale: 48, result: 55, trust: 50, style: null, onSelect: noop, onOpenProfile: noop, onStyleChange: noop } as const;
const cards = (S: () => React.ReactNode) => <div style={{ width: 1100, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}><S /></div>;

/** The team as the canvas draws it (D232): the style in words, the mood as a word and a shape, a flag, time this period. */
export const Cards: Story = {
  decorators: [cards],
  render: () => (
    <>
      <DeskCard {...card} name="Kent Goldberg" mood="frustrated" selected desk={{ style: 'Guiding', flag: 'Wants to talk', time: null }} />
      <DeskCard {...card} name="Beth Killiney" mood="happy" desk={{ style: 'Directing', flag: null, time: 'This week: Coach member, Day 2' }} />
      <DeskCard {...card} name="Green Bell" mood="neutral" away desk={{ style: null, flag: 'On leave for 2 days', time: null }} />
      <DeskCard {...card} name="Derick Kaynes" mood="concerned" unavailableReason="Same stage as Justin" desk={{ style: 'Partnering', flag: null, time: null }} />
    </>
  )
};

/** Revenue against the target and the score with today's change, in the navy bar (D232). */
export const Status: Story = {
  decorators: [S => <div className="il-chrome" style={{ width: 600, padding: 16 }}><S /></div>],
  render: () => <DeskStatus value={60000} target={240000} score={412} delta={33} />
};
