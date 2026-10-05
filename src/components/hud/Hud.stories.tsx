import type { Meta, StoryObj } from '@storybook/react-vite';
import { Hud, type HudProps } from './Hud';

const meta: Meta<typeof Hud> = { title: 'Components/HUD', component: Hud };
export default meta;
type Story = StoryObj<typeof Hud>;

const noop = () => {};
const NAV = ['Objective', 'Funnel', 'History', 'Badges', 'More'].map(label => ({ key: label.toLowerCase(), label }));

/** The board's own values: Week 2, Day 3, 2½ of 5 days left. */
const base: HudProps = {
  nav: NAV, onNav: noop,
  clock: { period: 2, periodUnit: 'week', subPeriod: 3, subPeriodUnit: 'day', capacity: 5, capacityLeft: 2.5 },
  sessionClock: '38:12', onPause: noop,
  score: { total: 1240, business: 420, people: 510, leadership: 310 }, pillarScale: 1000,
  streak: 3, onPalette: noop, onSettings: noop, onEndPeriod: noop, endEmphasis: 'primary'
};
const clock = (c: Partial<HudProps['clock']>) => ({ ...base.clock, ...c });
const sized = (width: number, height?: number): Pick<Story, 'decorators'> => ({ decorators: [S => <div style={{ width, height }}><S /></div>] });
const frame = sized(1440);

export const WeeksAndDays: Story = { ...frame, args: base };

/** A month based storyline: "Month 2 · Week 3", "1½ weeks left", "End month 2". */
export const MonthsAndWeeks: Story = { ...frame, args: { ...base, clock: { period: 2, periodUnit: 'month', subPeriod: 3, subPeriodUnit: 'week', capacity: 4, capacityLeft: 1.5 } } };

/** A year based storyline paid in quarters. */
export const YearsAndQuarters: Story = { ...frame, args: { ...base, clock: { period: 3, periodUnit: 'year', subPeriod: 2, subPeriodUnit: 'quarter', capacity: 4, capacityLeft: 3 } } };

/** Out of capacity: every bolt empty, "No days left". */
export const CapacitySpent: Story = { ...frame, args: { ...base, clock: clock({ capacityLeft: 0 }) } };

/** One day left: the bolts pulse (off under reduced motion). */
export const CapacityOneLeft: Story = { ...frame, args: { ...base, clock: clock({ capacityLeft: 1 }) } };

/** Half a day left: one half filled bolt, "½ day left", pulsing. */
export const CapacityHalfLeft: Story = { ...frame, args: { ...base, clock: clock({ capacityLeft: 0.5 }) } };

export const CapacityFull: Story = { ...frame, args: { ...base, clock: clock({ subPeriod: 1, capacityLeft: 5 }) } };

/** The participant turned the session clock off in settings. */
export const ClockHidden: Story = { ...frame, args: { ...base, sessionClock: null } };
/** The engine board keeps Pause with the clock hidden. */
export const PauseWithoutClock: Story = { ...frame, args: { ...base, sessionClock: null, alwaysPause: true } };

export const NoStreak: Story = { ...frame, args: { ...base, streak: 0 } };

/** Breakdown open, as on hover or focus. Bars are each pillar over its run maximum (pillarScale). */
export const ScoreBreakdownOpen: Story = {
  ...sized(1440, 280),
  args: { ...base, scoreOpen: true }
};

/** End week is secondary while an action drawer is open. */
export const EndSecondary: Story = { ...frame, args: { ...base, endEmphasis: 'secondary' } };

/** Client theme as the design renders it today (DECISIONS D17): logo placeholder, three unlabelled nav buttons. At 1280. */
export const ClientNav: Story = {
  ...sized(1280),
  args: { ...base, clientLogo: true, nav: [{ key: 'objective' }, { key: 'history' }, { key: 'more' }] }
};

/** Large numbers through the number formatter. */
export const LargeValues: Story = { ...sized(1440, 280), args: { ...base, clock: clock({ period: 10, subPeriod: 5 }), score: { ...base.score, total: 12480, business: 980, people: 1000, leadership: 40 }, streak: 12, scoreOpen: true } };
