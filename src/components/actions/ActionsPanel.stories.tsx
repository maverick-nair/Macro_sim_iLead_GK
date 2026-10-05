import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ActionDrawer } from '../action/ActionDrawer';
import type { ActionTileProps } from '../action/ActionTile';
import { ActionsPanel, type ActionsPanelProps } from './ActionsPanel';

const meta: Meta = { title: 'Components/Actions panel' };
export default meta;

const noop = () => {};

/** Team and member actions, with blocks worked out for the capacity left, the way the board does. */
const teamFor = (left: number): ActionTileProps[] => [
  { name: 'Meet the team', kind: 'live', days: 1 },
  { name: 'Send email', kind: 'live', days: 0 },
  { name: 'Send for training', kind: 'static', days: 2 },
  { name: 'Energize the team', kind: 'static', days: 0.5 },
  { name: 'Swap roles', kind: 'hybrid', days: 1 },
  { name: 'Hire member', kind: 'live', days: 1, block: { reason: 'locked', text: 'Unlocks in week 3' } }
].map(a => ({ ...a, onPick: noop, block: a.block ?? (a.days > left ? { reason: 'days', need: a.days, have: left } : undefined) } as ActionTileProps));
const memberFor = (left: number): ActionTileProps[] => [
  { name: 'Meet face to face', kind: 'live', days: 0.5, duration: 'About 6 minutes' },
  { name: 'Coach member', kind: 'live', days: 1, duration: 'About 10 minutes' },
  { name: 'Give feedback', kind: 'live', days: 0.5, duration: 'About 4 minutes' },
  { name: 'Set goals', kind: 'live', days: 0.5, duration: 'About 5 minutes' },
  { name: 'Assess member', kind: 'static', days: 1 },
  { name: 'Reward member', kind: 'hybrid', days: 0.5 },
  { name: 'Let go', kind: 'hybrid', days: 1 }
].map(a => ({ ...a, onPick: noop, block: a.days > left ? { reason: 'days', need: a.days, have: left } : undefined } as ActionTileProps));

/** The panel sits in a 330px column that runs the height of the board. */
const Frame = (p: Partial<ActionsPanelProps> & { height?: number; width?: number }) => {
  const left = p.capacityLeft ?? 3;
  return (
    <div style={{ width: p.width ?? 330, height: p.height ?? 900, display: 'flex', flexDirection: 'column' }}>
      <ActionsPanel capacityLeft={left} capacity={5} subPeriodUnit="day" outOfCapacity={left === 0} team={teamFor(left)} member={null} {...p} />
    </div>
  );
};

/** Frame b1: nobody selected, 3 days left. */
export const NoMemberSelected: StoryObj = { render: () => <Frame /> };

/** Frame b2: Kent selected, his actions listed. */
export const MemberSelected: StoryObj = { render: () => <Frame member={{ firstName: 'Kent', tiles: memberFor(3) }} /> };

/** Half days left: "2½ days left", and the 3 day actions say "Needs 2 days, you have ½ day". */
export const HalfDays: StoryObj = { render: () => <Frame capacityLeft={0.5} member={{ firstName: 'Kent', tiles: memberFor(0.5) }} /> };
export const TwoAndAHalfDays: StoryObj = { render: () => <Frame capacityLeft={2.5} member={{ firstName: 'Kent', tiles: memberFor(2.5) }} /> };

/** All capacity used: the notice, every costed action blocked. Email still costs nothing. */
export const OutOfCapacity: StoryObj = { render: () => <Frame capacityLeft={0} member={{ firstName: 'Kent', tiles: memberFor(0) }} /> };

/** A month based storyline paid in weeks: "1½ weeks left", "Needs 2 weeks, you have 1½ weeks". */
export const WeeksAsTheUnit: StoryObj = { render: () => <Frame subPeriodUnit="week" periodUnit="month" capacity={4} capacityLeft={1.5} member={{ firstName: 'Kent', tiles: memberFor(1.5) }} /> };
export const WeeksOutOfCapacity: StoryObj = { render: () => <Frame subPeriodUnit="week" periodUnit="month" capacity={4} capacityLeft={0} /> };

/** Frame b6: an action flow open, the drawer replaces the lists. In weeks, the drawer's cost reads in weeks too. */
export const WithDrawer: StoryObj = {
  render: () => <Frame drawer={
    <ActionDrawer name="Meet face to face" kind="live" days={0.5} description="About 6 minutes. In voice or text, you can switch at any time."
      people={{ mode: 'with' }} picks={[{ id: 'kent', name: 'Kent Goldberg', img: '/assets/npc/kent.png' }]}
      summary="Meet face to face with Kent. ½ day. About 6 minutes, in voice or text." cta="start" canConfirm onConfirm={noop} onBack={noop} />} />
};
export const WithDrawerInWeeks: StoryObj = {
  render: () => <Frame subPeriodUnit="week" periodUnit="month" drawer={
    <ActionDrawer name="Send for training" kind="static" days={2} description="Build skill away from the desk." people={{ mode: 'pick', max: 3, limit: 'Up to 3 people' }} picks={[]}
      nudge={{ name: 'Justin', area: 'Qualification', days: 1, onAssess: noop, onContinue: noop }}
      summary="Pick up to 3 people. 2 weeks." cta="confirm" canConfirm={false} onConfirm={noop} onBack={noop} />} />
};

/** Pick a tile to open the drawer, back to return. */
export const Interactive: StoryObj = {
  render: function Render() {
    const [open, setOpen] = useState<string | null>(null);
    const team = teamFor(3).map(a => ({ ...a, onPick: () => setOpen(a.name) }));
    return <Frame team={team} drawer={open ? <ActionDrawer name={open} kind="static" days={1} description="" people={{ mode: 'who' }} picks={[]} summary={open} cta="confirm" canConfirm onConfirm={() => setOpen(null)} onBack={() => setOpen(null)} /> : undefined} />;
  }
};

/**
 * Sponsor perks: a bonus day added this week, and a CEO check in that took one. Extra hire budget makes
 * the next hire free and lets it take a seat past a full team; a team activity skips its cooldown.
 */
export const Perks: StoryObj = {
  render: () => {
    const team = teamFor(5).map(a => (a.name === 'Hire member' ? { ...a, block: undefined, days: 0, perk: 'No days, one seat past a full team' }
      : a.name === 'Energize the team' ? { ...a, perk: 'No cooldown this time' } : a));
    return <Frame capacityLeft={5} capacity={6} team={team} notes={[{ text: 'Bonus day added this week', tone: 'gain' }, { text: 'The CEO check in took a day this week', tone: 'neutral' }]} />;
  }
};

/** The drawer for a free hire: the perk under the description. */
export const PerkInDrawer: StoryObj = {
  render: () => <Frame drawer={<ActionDrawer name="Hire member" kind="live" days={0} description="Interview two candidates, then hire one or pass." perk="Extra hire budget from your sponsor: no days, and one seat past a full team." people={{ mode: 'who' }} picks={[]} summary="Hire member. Costs nothing." cta="start" canConfirm onConfirm={noop} onBack={noop} />} />
};

/** Phone width, 390 minus the 16px gutters; the panel keeps its own padding. */
export const Narrow: StoryObj = { render: () => <Frame width={358} height={760} member={{ firstName: 'Kent', tiles: memberFor(3) }} /> };

/** A board under 1280 wide (D58): the header has a toggle that folds the card to its rail. Interactive. */
function Folding() {
  const [collapsed, setCollapsed] = useState(false);
  return <Frame width={collapsed ? 96 : 330} collapse={{ collapsed, open: 5, onToggle: () => setCollapsed(c => !c) }} />;
}
export const Collapsible: StoryObj = { render: () => <Folding /> };

/** Folded: a 72px rail with the actions open now; it expands on demand. */
export const Collapsed: StoryObj = { render: () => <Frame width={96} collapse={{ collapsed: true, open: 5, onToggle: noop }} /> };
