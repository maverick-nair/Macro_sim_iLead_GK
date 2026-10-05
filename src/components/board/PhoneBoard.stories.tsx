import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ReactNode } from 'react';
import { EngineProvider } from '../../engine/react';
import { createMockClient } from '../../engine/mock';
import type { ActionDrawerProps } from '../action/ActionDrawer';
import type { ActionTileProps } from '../action/ActionTile';
import type { MemberCardProps } from '../member/MemberCard';
import { OutcomePanel } from '../outcome/OutcomePanel';
import type { ProfilePanelProps } from '../profile/ProfilePanel';
import type { StageColumn } from '../team/TeamBoard';
import { EngineBoard } from './EngineBoard';
import { PhoneBoard, type PhoneBoardProps, type PhoneSheet } from './PhoneBoard';
import { SponsorCall } from './SponsorCall';

const meta: Meta = { title: 'Board/Phone board (390)', parameters: { layout: 'fullscreen' } };
export default meta;

const noop = () => {};

/**
 * A 390 by 844 phone. The transform makes it the containing block of the dock and the sheets
 * (position fixed), so they sit inside the frame as on a phone.
 */
function Phone({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 390, height: 844, overflowY: 'auto', overflowX: 'hidden', transform: 'translateZ(0)', display: 'flex', flexDirection: 'column', outline: '1px solid var(--il-color-line-default)' }}>
      {children}
    </div>
  );
}

type Card = MemberCardProps & { id: string };
const person = (id: string, name: string, title: string, over: Partial<Card> = {}): Card => ({
  id, name, title, img: `/assets/npc/${id}.png`, mood: 'neutral', skill: 50, morale: 50, result: 50, trust: 50, style: 'G', statsHidden: true,
  onSelect: noop, onOpenProfile: noop, onStyleChange: noop, ...over
});
const COLUMNS: StageColumn[] = [
  { key: 'leads', name: 'Leads', count: 2, ideal: 2, bottleneck: false, cards: [
    person('kent', 'Kent Goldberg', 'Lead Generation Executive', { mood: 'frustrated', statsHidden: false, trust: 24, unread: true }),
    person('beth', 'Beth Killiney', 'Lead Generation Executive', { mood: 'happy' })] },
  { key: 'qualify', name: 'Qualification', count: 2, ideal: 2, bottleneck: false, cards: [
    person('justin', 'Justin Keel', 'Lead Qualifier', { mood: 'concerned', promise: 'Career talk due Friday' }),
    person('derick', 'Derick Kaynes', 'Lead Qualifier')] },
  { key: 'conversion', name: 'Conversion', count: 2, ideal: 2, bottleneck: true, cards: [
    person('ruth', 'Ruth Ether', 'Conversion Specialist with a very long job title that wraps onto a second line', { away: true }),
    person('mandy', 'Mandy Lobert', 'Conversion Specialist', { mood: 'happy', statsHidden: false, trust: 71 })] }
];
const tile = (name: string, kind: ActionTileProps['kind'], days = 1, over: Partial<ActionTileProps> = {}): ActionTileProps => ({ name, kind, days, onPick: noop, ...over });
const TEAM = [tile('Meet the team', 'live'), tile('Energize the team', 'static', 2), tile('Hire member', 'live', 1, { block: { reason: 'locked', text: 'Unlocks in week 3' } })];
const FOR_KENT = [tile('Meet face to face', 'live'), tile('Send for training', 'static'), tile('Assess member', 'static'), tile('Reward member', 'hybrid', 1, { block: { reason: 'cooldown', text: 'Available again in 4 days' } })];

const DRAWER: ActionDrawerProps = {
  name: 'Send for training', kind: 'static', days: 1, description: 'Build skill away from the desk. Up to 3 people.',
  options: [{ name: 'Send for 3 day training', detail: 'Away for 3 days afterwards.' }, { name: 'Send for 1 week workshop', detail: 'Takes 2 days. Away for 5 days afterwards.' }],
  option: 0, onOption: noop, people: { mode: 'pick', max: 3, limit: '1 to 3 people' },
  picks: [{ id: 'kent', name: 'Kent Goldberg', img: '/assets/npc/kent.png' }], summary: 'Send for 3 day training, with Kent. Costs 1 day.',
  cta: 'confirm', canConfirm: true, onConfirm: noop, onBack: noop
};

const PROFILE: ProfilePanelProps = {
  name: 'Kent Goldberg', title: 'Lead Generation Executive', img: '/assets/npc/kent.png', mood: 'frustrated', stats: { skill: 30, morale: 24, result: 52, trust: 52 }, style: 'G',
  facts: [{ key: 'tenure', value: '1 month ago' }, { key: 'remarks', value: 'He expected a lot more from his current job and has already started complaining to others about his job.' }, { key: 'careerGoal', value: null }],
  shared: null, periodUnit: 'week', subPeriodUnit: 'day',
  timeline: [{ id: 't1', when: { period: 1, sub: 2 }, title: '1:1 conversation', quote: 'Since the territory split, my best leads go to Beth.', tone: 'pos', changes: [{ metric: 'morale', delta: 6 }] }],
  promises: [{ text: 'Review lead routing with Kent by Friday', status: 'open' }], actions: FOR_KENT, onClose: noop
};

function base(over: Partial<PhoneBoardProps> = {}): PhoneBoardProps {
  return {
    hud: {
      nav: [], onNav: noop, clock: { period: 2, periodUnit: 'week', subPeriod: 3, subPeriodUnit: 'day', capacity: 5, capacityLeft: 2.5 },
      sessionClock: null, onPause: noop, score: { total: 412, business: 40, people: 55, leadership: 38 }, streak: 1,
      onPalette: noop, onSettings: noop, onEndPeriod: noop, endEmphasis: 'primary'
    },
    strip: {
      kpis: [{ metric: 'skill', value: 56, trend: { kind: 'direction', direction: 'up' } }, { metric: 'morale', value: 48, trend: { kind: 'direction', direction: 'down' } },
        { metric: 'result', value: 59, trend: { kind: 'direction', direction: 'flat' } }, { metric: 'trust', value: 50, trend: { kind: 'direction', direction: 'flat' } }],
      pulse: { upbeat: 2, steady: 5, struggling: 3, value: 52, trend: 'down', periodUnit: 'week' },
      target: { label: '8 week target', value: 41200, target: 240000, pace: 0.25, pacePeriod: { unit: 'week', n: 2 } },
      sponsor: { level: 'steady', causes: [{ text: 'Revenue is behind week 2 pace', delta: -1 }], open: false, onToggle: noop,
        meter: { value: 52, unlockAt: 70, checkInBelow: 30, sponsorName: 'Paula', subPeriodUnit: 'day' } }
    },
    team: { hint: { kind: 'idle' }, legendOpen: false, onToggleLegend: noop, periodUnit: 'week', columns: COLUMNS },
    actions: { capacityLeft: 2.5, capacity: 5, subPeriodUnit: 'day', periodUnit: 'week', outOfCapacity: false, team: TEAM, member: null },
    drawer: null, picking: null, profile: null, sheet: 'none',
    inbox: { unread: 2, subPeriodUnit: 'day', sponsorName: 'Paula', onOpen: noop, onLater: noop, items: [
      { id: 'm1', sender: { kind: 'member', img: '/assets/npc/kent.png' }, tag: 'Chat from Kent', meta: '', title: 'Do you have 15 minutes today?', preview: 'Something has been bothering me.', urgent: true, due: 'Reply within 1 day', cta: 'reply' },
      { id: 'm2', sender: { kind: 'news' }, tag: 'News', meta: '', title: 'CEO check in', preview: 'The CEO wants a word about the numbers.', urgent: false, due: null, cta: 'read', later: false }] },
    onOpenSheet: noop, onCloseSheet: noop, onLower: noop,
    ...over
  };
}

const story = (over: Partial<PhoneBoardProps>): StoryObj => ({ render: () => <Phone><PhoneBoard {...base(over)} /></Phone> });

/** The plain board: HUD, KPI scroller, pulse, target and sponsor, the team by stage, the dock. */
export const Board = story({});
/** A person tapped: their actions first, the profile button, then the team's. */
export const PersonSheet = story({ sheet: 'actions', actions: { ...base().actions, member: { firstName: 'Kent', tiles: FOR_KENT } }, onOpenProfile: noop, team: { ...base().team, hint: { kind: 'selected', name: 'Kent Goldberg' }, columns: COLUMNS.map((c, i) => (i ? c : { ...c, cards: c.cards.map((x, j) => (j ? x : { ...x, selected: true })) })) } });
/** Nobody selected: the team's actions. */
export const ActionsSheet = story({ sheet: 'actions' });
/** The action drawer as a sheet. */
export const DrawerSheet = story({ sheet: 'drawer', drawer: DRAWER });
/** The drawer lowered to pick people on the list: rows are toggles, the dock counts. */
export const Picking = story({
  sheet: 'none', drawer: DRAWER, picking: { action: 'Send for training', count: 2, max: 3 },
  team: { ...base().team, hint: { kind: 'picking' }, columns: COLUMNS.map((c, i) => (i ? { ...c, cards: c.cards.map(x => (x.away ? { ...x, unavailableReason: 'Away in training for 2 days' } : x)) } : { ...c, cards: c.cards.map(x => ({ ...x, selected: true })) })) }
});
export const InboxSheet = story({ sheet: 'inbox' });
export const ProfileSheet = story({ sheet: 'profile', profile: PROFILE });
export const ScoreSheet = story({ sheet: 'score', breakdown: <p className="m-0 text-14">Score breakdown (ScoreBreakdown) shows here.</p> });
/** The outcome card over the list (frame m6 language) and a sponsor call ringing. */
export const OutcomeAndCall = story({
  call: <SponsorCall layout="phone" name="Paula Jacob" initials="PJ" line="Regional Sales Director. Recession strikes" laterLabel="Call back within 2 days" onAnswer={noop} onLater={noop} />,
  outcome: <OutcomePanel layout="card" headingLevel={2} person={{ id: 'kent', name: 'Kent Goldberg', shortName: 'Kent', img: '/assets/npc/kent.png' }}
    headline="Kent opened up about what is bothering him" reply="Okay. That would actually help." why={{ cause: 'You listened first', rule: 'Listening lifts trust', evidence: 'I hear you.', judgedByAI: true }}
    whyOpen={false} onToggleWhy={noop} affected={[]} revealed={null} onReveal={noop} changes={[{ name: 'Kent', metric: 'morale', delta: 6 }, { name: 'Kent', metric: 'trust', delta: 4 }]}
    showNumbers={false} onToggleNumbers={noop} ripple="Jack noticed you made time for Kent." changed={['Kent will update the CRM daily this week.']} onDismiss={noop} />
});

/** The interactive phone board: tap people, open sheets, pick people. */
export const Interactive: StoryObj = {
  render: function Render() {
    const [sheet, setSheet] = useState<PhoneSheet>('none');
    const [sel, setSel] = useState<string | null>(null);
    const name = COLUMNS.flatMap(c => c.cards).find(c => c.id === sel)?.name;
    const columns = COLUMNS.map(c => ({ ...c, cards: c.cards.map(x => ({ ...x, selected: x.id === sel, onSelect: () => { setSel(x.id); setSheet('actions'); } })) }));
    return (
      <Phone>
        <PhoneBoard {...base({
          sheet, onOpenSheet: setSheet, onCloseSheet: () => setSheet('none'), team: { ...base().team, columns, hint: name ? { kind: 'selected', name } : { kind: 'idle' } },
          actions: { ...base().actions, member: name ? { firstName: name.split(' ')[0], tiles: FOR_KENT } : null }
        })} />
      </Phone>
    );
  }
};

/** The playable phone board on the mock engine (Sales Elevator, seed 1), from style setting. */
export const PlayableOnEngine: StoryObj = {
  render: () => (
    <EngineProvider client={createMockClient({ seed: 1 })}>
      <Phone><EngineBoard phone onPause={noop} onSettings={noop} /></Phone>
    </EngineProvider>
  )
};
