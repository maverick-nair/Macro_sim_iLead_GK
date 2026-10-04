import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ReactNode } from 'react';
import { ProfilePanel, type ProfilePanelProps, type ProfileTimelineEntry } from './ProfilePanel';

const meta: Meta<typeof ProfilePanel> = { title: 'Components/Profile', component: ProfilePanel };
export default meta;
type Story = StoryObj<typeof ProfilePanel>;

const noop = () => {};

/** The panel sits over the board area (everything right of the inbox rail), as on frame b7. */
const BoardArea = ({ children }: { children: ReactNode }) => <div style={{ position: 'relative', width: 1376, height: 760 }}>{children}</div>;
const board: Pick<Story, 'decorators'> = { decorators: [S => <BoardArea><S /></BoardArea>] };

const ACTIONS: ProfilePanelProps['actions'] = [
  { name: 'Meet face to face', kind: 'live', days: 0.5, duration: 'About 6 minutes', onPick: noop },
  { name: 'Coach member', kind: 'live', days: 1, duration: 'About 10 minutes', onPick: noop },
  { name: 'Give feedback', kind: 'live', days: 0.5, duration: 'About 4 minutes', onPick: noop },
  { name: 'Set goals', kind: 'live', days: 0.5, duration: 'About 5 minutes', onPick: noop },
  { name: 'Assess member', kind: 'static', days: 1, onPick: noop },
  { name: 'Reward member', kind: 'hybrid', days: 0.5, block: { reason: 'cooldown', text: 'Cooldown: 6 days left' }, onPick: noop },
  { name: 'Let go', kind: 'hybrid', days: 1, block: { reason: 'days', need: 1, have: 0.5 }, onPick: noop }
];

/** Frame b7: Kent after the 1:1, newest first. */
const KENT_TIMELINE: ProfileTimelineEntry[] = [
  { id: 't4', when: { period: 2, sub: 3 }, title: '1:1 conversation', quote: 'Since the territory split, my best leads go to Beth. Nobody asked me.', tone: 'pos', changes: [{ metric: 'morale', delta: 8 }, { metric: 'trust', delta: 6 }] },
  { id: 't3', when: { period: 2, sub: 2 }, title: 'Chat request went unanswered', quote: 'Do you have 15 minutes today? Something has been bothering me.', tone: 'neg', changes: [{ metric: 'morale', delta: -6 }] },
  { id: 't2', when: { period: 1, sub: 4 }, title: 'Style: Directing', tone: 'neg', reaction: 'felt micromanaged', changes: [{ metric: 'morale', delta: -4 }] },
  { id: 't1', when: { period: 1, sub: 1 }, title: 'Meet the team', quote: 'Happy to be here. Busy week ahead.', tone: 'neutral', changes: [] }
];

const kent: ProfilePanelProps = {
  name: 'Kent Goldberg', title: 'Senior Sales Development Rep', img: '/assets/npc/kent.png', mood: 'neutral',
  stats: { skill: 35, morale: 9, result: 37, trust: 30 }, style: 'D',
  facts: [
    { key: 'previous', value: 'Brightline Media' }, { key: 'tenure', value: '6 years' }, { key: 'experience', value: '9 years in sales' },
    { key: 'skills', value: 'Cold calling, territory knowledge' }, { key: 'remarks', value: 'Top prospector two years running. CRM updates lag.' },
    { key: 'careerGoal', value: 'Wants to mentor new hires' }, { key: 'relationships', value: 'Mentored Derick early on. Tension with Beth over lead routing.' }
  ],
  shared: 'feels overlooked since the territory split moved his best leads to Beth.',
  periodUnit: 'week', subPeriodUnit: 'day',
  timeline: KENT_TIMELINE,
  promises: [{ text: 'Review lead routing with Kent by Friday', status: 'open' }],
  actions: ACTIONS, onClose: noop
};
const withFact = (key: ProfilePanelProps['facts'][number]['key'], value: string | null) => kent.facts.map(f => (f.key === key ? { ...f, value } : f));

/** Frame b7: stats revealed, the concern Kent shared, his career goal and an open promise. */
export const StatsRevealed: Story = { ...board, args: kent };

/** Before the 1:1: no concern surfaced, the career goal not shared yet. */
export const CareerGoalHidden: Story = { ...board, args: { ...kent, mood: 'frustrated', shared: null, facts: withFact('careerGoal', null), timeline: KENT_TIMELINE.slice(1), promises: [] } };

/** Career goal revealed in conversation, no concern shared yet. */
export const CareerGoalRevealed: Story = { ...board, args: { ...kent, shared: null } };

/** A hidden concern that has surfaced, in the spec's wording. */
export const SharedConcern: Story = { ...board, args: { ...kent, shared: 'feels his role is not what he was promised.' } };

/** Long remarks and relationships wrap inside the fact column. */
export const LongRemarks: Story = {
  ...board,
  args: { ...kent, facts: kent.facts.map(f => (f.key === 'remarks'
    ? { ...f, value: 'Top prospector two years running and the person new reps go to when a call goes sideways. CRM updates lag by days, which hides his pipeline from forecasting, and he has twice missed the Friday pipeline review because he was still on calls.' }
    : f.key === 'relationships' ? { ...f, value: 'Mentored Derick early on and still has lunch with him most weeks. Tension with Beth over lead routing since the territory split. Gets on well with Ruth.' } : f)) }
};

/** Nothing has happened with this person yet. Unknown facts read "Not known yet", no style chosen. */
export const EmptyTimeline: Story = {
  ...board,
  args: { ...kent, name: 'Beth Killiney', title: 'Sales Development Rep', img: '/assets/npc/beth.png', mood: 'happy', stats: { skill: 25, morale: 57, result: 32, trust: 48 }, style: null,
    shared: null, facts: [{ key: 'previous', value: 'Retail banking' }, { key: 'tenure', value: '3 weeks' }, { key: 'experience', value: null }, { key: 'careerGoal', value: null }, { key: 'relationships', value: null }],
    timeline: [], promises: [] }
};

/** Many entries: the interactions column scrolls on its own. */
export const LongTimeline: Story = {
  ...board,
  args: { ...kent, timeline: Array.from({ length: 4 }, (_, w) => KENT_TIMELINE.map(e => ({ ...e, id: `${e.id}:${w}`, when: { period: e.when.period + (3 - w) * 2, sub: e.when.sub } }))).flat() }
};

/** One promise of each status: open in the dashed box, kept and broken as quieter lines. */
export const Promises: Story = {
  ...board,
  args: { ...kent, promises: [
    { text: 'Review lead routing with Kent by Friday', status: 'open' },
    { text: 'Career talk in week 1', status: 'kept' },
    { text: 'Reply to his chat the same day', status: 'broken' }
  ] }
};

/** Away in training: grey portrait, "In training", and most actions blocked until Day 4. */
export const Away: Story = {
  ...board,
  args: { ...kent, name: 'Peter Higgins', title: 'Account Qualifier', img: '/assets/npc/peter.png', mood: 'concerned', away: true, stats: { skill: 19, morale: 20, result: 26, trust: 24 }, shared: null,
    facts: [{ key: 'previous', value: 'Graduate programme' }, { key: 'tenure', value: '5 months' }, { key: 'experience', value: 'First sales role' }, { key: 'skills', value: 'Research, data entry' },
      { key: 'remarks', value: 'Asked for help once, then went quiet.' }, { key: 'careerGoal', value: null }, { key: 'relationships', value: 'Keeps to himself.' }],
    timeline: [{ id: 's', when: { period: 1, sub: 4 }, title: 'Style: Directing', tone: 'neg', reaction: 'negative', changes: null }, { id: 'm', when: { period: 1, sub: 1 }, title: 'Meet the team', tone: 'neutral', changes: [] }],
    promises: [], actions: ACTIONS.map(a => (a.name === 'Give feedback' ? a : { ...a, block: { reason: 'away' as const, untilDay: 4 } })) }
};

/** A month based storyline: "Style this month", "Month 2, Week 3", costs in weeks ("½ week"). */
export const MonthsAndWeeks: Story = {
  ...board,
  args: { ...kent, periodUnit: 'month', subPeriodUnit: 'week', timeline: KENT_TIMELINE.map(e => ({ ...e, when: { period: e.when.period, sub: Math.min(e.when.sub, 4) } })) }
};

/** Open and close: focus moves into the panel, Escape or the close button returns it to the opener. */
export const Interactive: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <BoardArea>
        <button type="button" onClick={() => setOpen(true)}>Open profile</button>
        {open && <ProfilePanel {...kent} onClose={() => setOpen(false)} />}
      </BoardArea>
    );
  }
};
