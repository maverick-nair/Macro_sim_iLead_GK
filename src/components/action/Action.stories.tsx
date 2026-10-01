import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ReactNode } from 'react';
import { ActionDrawer, OptionCards, type ActionDrawerProps } from './ActionDrawer';
import { ActionTile, type ActionTileProps } from './ActionTile';

const meta: Meta = { title: 'Components/Action' };
export default meta;

const noop = () => {};
const panel = (children: ReactNode, width = 288) => <div style={{ width, display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>;

const TILES: Array<Omit<ActionTileProps, 'onPick'>> = [
  { name: 'Meet face to face', kind: 'live', days: 0.5, duration: 'About 6 minutes' },
  { name: 'Meet the team', kind: 'live', days: 1 },
  { name: 'Swap roles', kind: 'hybrid', days: 1 },
  { name: 'Energize the team', kind: 'static', days: 0.5 },
  { name: 'Send email', kind: 'live', days: 0 },
  { name: 'Send for training', kind: 'static', days: 2 },
  { name: 'Hire member', kind: 'live', days: 1, block: { reason: 'locked', text: 'Unlocks in week 3' } },
  { name: 'Reward member', kind: 'hybrid', days: 0.5, block: { reason: 'cooldown', text: 'Cooldown: 6 days left' } },
  { name: 'Coach member', kind: 'live', days: 1, duration: 'About 10 minutes', block: { reason: 'away', untilDay: 4 } },
  { name: 'Assess member', kind: 'static', days: 1, block: { reason: 'planned' } },
  { name: 'Send for training', kind: 'static', days: 2, block: { reason: 'days', need: 2, have: 1.5 } }
];

/**
 * Every tile state: available live, hybrid and instant, then locked, cooldown, away, planned today
 * and not enough days. Unavailable tiles stay in the tab order and read their reason as the
 * description; hover shows it as a tooltip.
 */
export const Tiles: StoryObj = { render: () => panel(TILES.map((t, i) => <ActionTile key={i} {...t} onPick={noop} />)) };

/** The profile's "Take an action" column: no icon, roomier padding. */
export const CompactTiles: StoryObj = { render: () => panel(TILES.map((t, i) => <ActionTile key={i} {...t} layout="compact" onPick={noop} />), 300) };

export const LongName: StoryObj = {
  render: () => panel(<>
    <ActionTile name="Run a structured career conversation about next quarter" kind="live" days={1.5} duration="About 25 minutes" onPick={noop} />
    <ActionTile name="Hire member" kind="live" days={1} block={{ reason: 'locked', text: 'Unlocks after the sponsor approves a new seat in week 3' }} onPick={noop} />
  </>)
};

export const TilePlayground: StoryObj<typeof ActionTile> = {
  render: args => panel(<ActionTile {...args} />),
  args: { name: 'Meet face to face', kind: 'live', days: 0.5, duration: 'About 6 minutes', layout: 'panel', onPick: noop },
  argTypes: { kind: { control: 'inline-radio', options: ['live', 'hybrid', 'static'] }, layout: { control: 'inline-radio', options: ['panel', 'compact'] }, days: { control: { type: 'range', min: 0, max: 5, step: 0.5 } } }
};

/** Option cards are a radio group: one tab stop, arrow keys move and select. */
export const Options: StoryObj = {
  render: function Render() {
    const [v, setV] = useState<number | null>(0);
    return <div style={{ width: 294 }}><OptionCards value={v} onChange={setV} options={[{ name: 'Team lunch', detail: 'Informal lunch, everyone together.' }, { name: 'Team building', detail: 'Half day activity away from desks.' }]} /></div>;
  }
};

const img = (id: string) => `/assets/npc/${id}.png`;
const drawer = (p: Partial<ActionDrawerProps>, width = 330) => (
  <div style={{ width, height: 760, display: 'flex', flexDirection: 'column', borderRadius: 22, background: 'var(--il-color-surface-card)', border: '1px solid var(--il-color-line-default)', overflow: 'hidden' }}>
    <ActionDrawer name="" kind="static" days={0} description="" people={{ mode: 'who' }} picks={[]} summary="" cta="confirm" canConfirm onConfirm={noop} onBack={noop} {...p} />
  </div>
);

/** Frame b4: static action with options, people picked on the board. */
export const DrawerStatic: StoryObj = {
  render: () => drawer({
    name: 'Send for training', kind: 'static', days: 2, description: 'Build skill away from the desk.',
    options: [{ name: '1 day workshop', detail: 'Skill +2 to +4. Away 1 day.' }, { name: '1 week workshop', detail: 'Larger skill gain. Away 5 days.' }], option: 1,
    people: { mode: 'pick', max: 3, limit: 'Up to 3 people' },
    picks: [{ id: 'mandy', name: 'Mandy Lobert', img: img('mandy') }, { id: 'justin', name: 'Justin Keel', img: img('justin') }, { id: 'beth', name: 'Beth Killiney', img: img('beth') }],
    summary: 'Send Mandy, Justin and Beth to a 1 week workshop. 2 days.'
  })
};

/** Frame b5: hybrid action with the prerequisite nudge. */
const NUDGE: Partial<ActionDrawerProps> = {
    name: 'Swap roles', kind: 'hybrid', days: 1, description: 'Move two people between stages, then explain the decision.',
    people: { mode: 'pick', max: 2, limit: 'Needs 2 people in different stages' },
    picks: [{ id: 'justin', name: 'Justin Keel', img: img('justin') }, { id: 'beth', name: 'Beth Killiney', img: img('beth') }],
    nudge: { name: 'Justin', area: 'Qualification', days: 1, onAssess: noop, onContinue: noop },
    summary: 'Swap Justin and Beth, then explain it to them. 1 day.', cta: 'start'
};
export const DrawerNudge: StoryObj = { render: () => drawer(NUDGE) };

/** Frame b6: live member action; confirm starts the conversation. */
export const DrawerLive: StoryObj = {
  render: () => drawer({
    name: 'Meet face to face', kind: 'live', days: 0.5, description: 'About 6 minutes. In voice or text, you can switch at any time.',
    people: { mode: 'with' }, picks: [{ id: 'kent', name: 'Kent Goldberg', img: img('kent') }],
    summary: 'Meet face to face with Kent. ½ day. About 6 minutes, in voice or text.', cta: 'start'
  })
};

/** Nobody picked yet: confirm stays disabled. */
export const DrawerEmptyPicks: StoryObj = {
  render: () => drawer({
    name: 'Swap roles', kind: 'hybrid', days: 1, description: 'Move two people between stages, then explain the decision.',
    people: { mode: 'pick', max: 2, limit: 'Needs 2 people in different stages' }, picks: [],
    summary: 'Pick two people in different stages. 1 day.', cta: 'start', canConfirm: false
  })
};

export const DrawerEmail: StoryObj = {
  render: () => drawer({ name: 'Send email', kind: 'live', days: 0, description: 'Write to one person or many. Replies arrive in your inbox.', summary: 'Opens the email composer. No days used.', cta: 'composer' })
};

/** Pick options and toggle people, the way the board does. */
export const DrawerInteractive: StoryObj = {
  render: function Render() {
    const all = [{ id: 'mandy', name: 'Mandy Lobert', img: img('mandy') }, { id: 'justin', name: 'Justin Keel', img: img('justin') }, { id: 'beth', name: 'Beth Killiney', img: img('beth') }, { id: 'kent', name: 'Kent Goldberg', img: img('kent') }];
    const [opt, setOpt] = useState<number | null>(0);
    const [n, setN] = useState(1);
    const picks = all.slice(0, n);
    const opts = [{ name: '1 day workshop', detail: 'Skill +2 to +4. Away 1 day.' }, { name: '1 week workshop', detail: 'Larger skill gain. Away 5 days.' }];
    return (
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {drawer({ name: 'Send for training', kind: 'static', days: 2, description: 'Build skill away from the desk.', options: opts, option: opt, onOption: setOpt,
          people: { mode: 'pick', max: 3, limit: 'Up to 3 people' }, picks, summary: `Send ${picks.map(p => p.name.split(' ')[0]).join(', ')} to a ${opts[opt ?? 0].name.toLowerCase()}. 2 days.` })}
        <button type="button" onClick={() => setN(x => (x % 3) + 1)}>Add a person</button>
      </div>
    );
  }
};

/** Phone width, 390 minus the 16px gutters. */
export const DrawerMobileWidth: StoryObj = { render: () => drawer(NUDGE, 358) };
