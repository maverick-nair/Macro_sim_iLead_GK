import type { Meta, StoryObj } from '@storybook/react-vite';
import { BRIGHTWATER, withClientTheme } from '../../stories/clientTheme';
import { Hud, type HudProps } from './Hud';
import { GameMenu, type GameMenuItem } from './GameMenu';

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

/** The Halden client theme at 1280: the logo placeholder, and the nav reads Objective, History and More (D17, fixed in M7). */
export const ClientNav: Story = {
  decorators: [withClientTheme(), S => <div style={{ width: 1280 }}><S /></div>],
  args: { ...base, nav: NAV.filter(n => ['objective', 'history', 'more'].includes(n.key)) }
};

/** A client theme with a text logo and a corrected palette (Brightwater, D72). */
export const ClientTextLogo: Story = {
  decorators: [withClientTheme(BRIGHTWATER), S => <div style={{ width: 1440 }}><S /></div>],
  args: base
};

/** Large numbers through the number formatter. */
export const LargeValues: Story = { ...sized(1440, 280), args: { ...base, clock: clock({ period: 10, subPeriod: 5 }), score: { ...base.score, total: 12480, business: 980, people: 1000, leadership: 40 }, streak: 12, scoreOpen: true } };

const MENU: GameMenuItem[] = (['objectives', 'tutorial', 'history', 'overview', 'leaderboard', 'actions', 'tour', 'settings', 'fullscreen', 'exit'] as const).map(key => ({ key, onSelect: noop }));
/** The engine board's HUD with the game menu (D89) in place of the hidden nav (D38). */
export const WithMenu: Story = { ...sized(1440, 520), args: { ...base, nav: [], menu: <GameMenu items={MENU} /> } };
/** The game menu open: Objectives, Tutorial and video, History, Results and stages, Leaderboard, About these actions, Guided tour, Settings, Full screen, Exit. */
export const MenuOpen: Story = { ...sized(1440, 520), args: { ...base, nav: [], menu: <GameMenu items={MENU} defaultOpen /> } };
/** At 1280 the menu fits beside the clock and score. */
export const MenuAt1280: Story = { ...sized(1280, 120), args: { ...base, nav: [], menu: <GameMenu items={MENU.filter(m => m.key !== 'leaderboard')} /> } };
