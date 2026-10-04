import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ReactNode } from 'react';
import { InboxDrawer, type InboxDrawerItem, type InboxDrawerProps } from './InboxDrawer';
import { InboxRail, type InboxRailItem } from './InboxRail';

const meta: Meta = { title: 'Components/Inbox' };
export default meta;

const noop = () => {};

/** One of each kind: a member chat (pinned, with a deadline), a sponsor note, news and a member email. */
const ITEMS: InboxDrawerItem[] = [
  { id: 'i1', sender: { kind: 'member', img: '/assets/npc/kent.png' }, tag: 'Chat from Kent', meta: 'Day 2, 16:40', title: 'Do you have 15 minutes today?', preview: 'Something has been bothering me.', urgent: true, due: 'Reply by Day 3', cta: 'reply' },
  { id: 'i2', sender: { kind: 'sponsor', initials: 'PN' }, tag: 'Priya, sponsor note', meta: 'Day 3, 9:10', title: 'Pipeline review moved to Friday', preview: 'Bring a view of demo conversions, please.', urgent: false, due: null, cta: 'reply' },
  { id: 'i3', sender: { kind: 'news' }, tag: 'News', meta: 'Day 3, 8:30', title: 'Ashcroft asks for 12% off to sign this week', preview: 'Impact event. See impact.', urgent: false, due: null, cta: 'impact' },
  { id: 'i4', sender: { kind: 'member', img: '/assets/npc/ruth.png' }, tag: 'Email from Ruth', meta: 'Day 3, 10:02', title: 'Leave request, Thursday and Friday', preview: 'Family matter. I can hand over the Brightwell draft.', urgent: false, due: null, cta: 'reply' }
];
const RAIL: InboxRailItem[] = ITEMS.map(it => ({ id: it.id, label: it.title, sender: it.sender, urgent: it.urgent }));

const Rail = ({ children }: { children: ReactNode }) => <div style={{ width: 64 }}>{children}</div>;

/** Frame b1: four unread, Kent's chat is urgent (amber ring). */
export const RailFourUnread: StoryObj = { render: () => <Rail><InboxRail unread={4} items={RAIL} onToggle={noop} onOpen={noop} /></Rail> };
/** Nothing unread: no badge, no sender buttons. */
export const RailEmpty: StoryObj = { render: () => <Rail><InboxRail unread={0} items={[]} onToggle={noop} onOpen={noop} /></Rail> };
/** Every item urgent. */
export const RailAllUrgent: StoryObj = { render: () => <Rail><InboxRail unread={4} items={RAIL.map(r => ({ ...r, urgent: true }))} onToggle={noop} onOpen={noop} /></Rail> };
/** Double digit badge. */
export const RailManyUnread: StoryObj = { render: () => <Rail><InboxRail unread={12} items={RAIL} onToggle={noop} onOpen={noop} /></Rail> };

/** The drawer is positioned against the board, beside the 64px rail. */
const Board = ({ children }: { children: ReactNode }) => <div style={{ position: 'relative', width: 480, height: 820 }}>{children}</div>;
const drawer = (p: Partial<InboxDrawerProps>) => <Board><InboxDrawer open subPeriodUnit="day" items={ITEMS} sponsorName="Priya" onClose={noop} onOpen={noop} onLater={noop} {...p} /></Board>;

/** Frame b3: all four kinds of item. */
export const DrawerAllKinds: StoryObj = { render: () => drawer({}) };
/** Frame b7: everything read. */
export const DrawerEmpty: StoryObj = { render: () => drawer({ items: [] }) };
/** Empty, no sponsor in the storyline. */
export const DrawerEmptyNoSponsor: StoryObj = { render: () => drawer({ items: [], sponsorName: undefined }) };
/** Paid in weeks: "Replying costs no weeks". */
export const DrawerUnitWeeks: StoryObj = { render: () => drawer({ subPeriodUnit: 'week' }) };
/**
 * Engine messages: a CEO check in is news that needs no answer (Mark as read, no Later); a sponsor
 * call put off with Later, pinned with its due; an event chat from a team member with its due.
 */
export const DrawerEngineKinds: StoryObj = {
  render: () => drawer({ items: [
    { id: 'n1', sender: { kind: 'sponsor', initials: 'PJ' }, tag: 'News', meta: '', title: 'CEO check in', preview: "Paula's confidence has dropped. The CEO wants a check in, which takes a day of your time next week.", urgent: true, due: null, cta: 'read', later: false },
    { id: 'c1', sender: { kind: 'sponsor', initials: 'PJ' }, tag: 'Paula, sponsor note', meta: '', title: 'Recession strikes', preview: 'Salaries across the company are lowered.', urgent: true, due: 'Due in 2 days', cta: 'reply' },
    { id: 'm1', sender: { kind: 'member', img: '/assets/npc/kent.png' }, tag: 'Chat from Kent', meta: '', title: 'Job offer', preview: 'I have been offered a role elsewhere. Can we talk?', urgent: false, due: 'Due in 2 days', cta: 'reply' }
  ] })
};
/** A pinned item with no deadline, and long text. */
export const DrawerLongText: StoryObj = {
  render: () => drawer({ items: [{ ...ITEMS[0], due: null, title: 'Can we talk about the territory split before the pipeline review on Friday?', preview: 'Since the split my best leads go to Beth and nobody asked me. I would like to understand how it was decided.' }, ITEMS[1]] })
};

/** Rail and drawer together: open from the rail, Later and Reply now mark items read. */
export const Interactive: StoryObj = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    const [read, setRead] = useState<string[]>([]);
    const items = ITEMS.filter(i => !read.includes(i.id));
    const done = (id: string) => setRead(r => [...r, id]);
    return (
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '64px 1fr', width: 480, height: 820 }}>
        <InboxRail unread={items.length} items={RAIL.filter(r => !read.includes(r.id))} onToggle={() => setOpen(o => !o)} onOpen={done} />
        <div />
        <InboxDrawer open={open} subPeriodUnit="day" items={items} sponsorName="Priya" onClose={() => setOpen(false)} onOpen={id => { done(id); setOpen(false); }} onLater={done} />
      </div>
    );
  }
};
