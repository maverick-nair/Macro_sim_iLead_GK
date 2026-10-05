import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { MetricChange } from '../../engine/contract';
import { EngineProvider } from '../../engine/react';
import { createMockClient, defaultStoryline } from '../../engine/mock';
import { EngineBoard } from './EngineBoard';
import { EventCard, type EventCardKind } from './EventCard';
import { SponsorCall } from './SponsorCall';

const meta: Meta = { title: 'Board/Engine board', parameters: { layout: 'fullscreen' } };
export default meta;

const noop = () => {};
const REASON = { label: 'New CRM', cause: 'A new system', rule: 'Events move every member', evidence: [] };

/** The playable board on the in-browser mock engine (Sales Elevator, seed 1). Starts in the style phase. */
export const Playable: StoryObj = {
  render: () => (
    <EngineProvider client={createMockClient({ seed: 1 })}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <EngineBoard onPause={noop} onSettings={noop} />
      </div>
    </EngineProvider>
  )
};


/** Hiring with room in every stage, from week 1: interview two candidates, compare, then hire or pass. */
export const InterviewOpen: StoryObj = {
  render: () => {
    const base = defaultStoryline();
    const config = { ...base, maxPerStage: 3, actions: base.actions.map(a => (a.key === 'hire' ? { ...a, unlockPeriod: 1 } : a)) };
    return (
      <EngineProvider client={createMockClient({ seed: 2, config })}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <EngineBoard onPause={noop} onSettings={noop} />
        </div>
      </EngineProvider>
    );
  }
};

/** A team wide event: changes to more than three people read as one team chip per metric. */
export const Event: StoryObj = {
  render: () => (
    <EventCard
      busy={false} onDismiss={noop} everyone={10} nameOf={c => (c.count > 1 ? `${c.count} people` : c.subject[0].toUpperCase() + c.subject.slice(1))}
      card={{ id: 'c1', key: 'crm', card: 'impact', title: 'New CRM system', body: 'Your firm has adopted a new CRM system and employees are forced to input leads electronically.', memberId: null, delivery: 'modal', label: null, messageId: null,
        changes: [...['kent', 'beth', 'justin', 'ruth'].map((subject): MetricChange => ({ subject, metric: 'morale', from: 50, to: 47, delta: -3, reason: REASON })),
          { subject: 'kent', metric: 'skill', from: 40, to: 42, delta: 2, reason: REASON }] }}
    />
  )
};

const CARDS: Array<{ card: EventCardKind; title: string; body: string; member?: string; label?: string }> = [
  { card: 'impact', title: 'New CRM system', body: 'Your firm has adopted a new CRM system and employees are forced to input leads electronically.' },
  { card: 'signal', title: 'Rumors of being acquired', body: 'Word is going round that a competitor wants to buy the company. People are asking you what it means for them.', member: 'lowe' },
  { card: 'capacity', title: 'Casual leave', body: 'Ruth will be on leave for the rest of the week. Someone needs to cover her proposals.', member: 'ruth', label: 'No impact on result' },
  { card: 'diagnostic', title: 'Performance declines', body: 'Peter has missed his numbers two weeks running. Something has changed.', member: 'peter' },
  { card: 'opportunity', title: 'A big client referral', body: 'A happy client has referred a large account to your proposal team. Handle it well and the pipeline grows.' },
  { card: 'crisis', title: 'Tragic accident', body: 'A colleague from another branch was in a serious accident. The team is shaken.' }
];

/** Every card type: the design's four art bands, and opportunity and crisis in the same language. A label shows when the storyline sets one. */
export const EventTypes: StoryObj = {
  render: function Render() {
    const [i, setI] = useState(0);
    const c = CARDS[i % CARDS.length];
    return (
      <EventCard key={i} busy={false} onDismiss={() => setI(n => n + 1)} everyone={10} nameOf={ch => (ch.count > 1 ? `${ch.count} people` : ch.subject)}
        img={c.member ? `/assets/npc/${c.member}.png` : null}
        card={{ id: `c${i}`, key: c.card, card: c.card, delivery: 'modal', title: c.title, body: c.body, memberId: c.member ?? null, label: c.label ?? null, messageId: null,
          changes: [{ subject: c.member ?? 'kent', metric: 'morale', from: 50, to: 46, delta: -4, reason: REASON }] }}
      />
    );
  }
};
export const EventOpportunity: StoryObj = { render: () => <EventCard busy={false} onDismiss={noop} everyone={10} nameOf={ch => ch.subject} card={{ id: 'o', key: 'referral', card: 'opportunity', delivery: 'modal', title: CARDS[4].title, body: CARDS[4].body, memberId: null, label: null, messageId: null, changes: [] }} /> };
export const EventCrisis: StoryObj = { render: () => <EventCard busy={false} onDismiss={noop} everyone={10} nameOf={ch => ch.subject} card={{ id: 'x', key: 'accident', card: 'crisis', delivery: 'modal', title: CARDS[5].title, body: CARDS[5].body, memberId: null, label: 'Shown to everyone', messageId: null, changes: [] }} /> };
export const EventSignalWithPortrait: StoryObj = { render: () => <EventCard busy={false} onDismiss={noop} everyone={10} nameOf={ch => ch.subject} img="/assets/npc/lowe.png" card={{ id: 's', key: 'rumors', card: 'signal', delivery: 'modal', title: CARDS[1].title, body: CARDS[1].body, memberId: 'lowe', label: null, messageId: null, changes: [] }} /> };

/** The incoming sponsor call (frame b13 on the engine): Take the call opens the conversation; Later leaves it in the inbox. */
export const SponsorCallRinging: StoryObj = {
  render: () => (
    <div style={{ width: 1440 }}>
      <SponsorCall name="Paula Jacob" initials="PJ" line="Regional Sales Director. Recession strikes" laterLabel="Call back within 2 days" onAnswer={noop} onLater={noop} />
    </div>
  )
};
/** Due now: Later, with no promise of a call back. */
export const SponsorCallDueNow: StoryObj = {
  render: () => (
    <div style={{ width: 1024 }}>
      <SponsorCall name="Paula Jacob" initials="PJ" line="Regional Sales Director. Paula has heard the team is struggling" laterLabel="Later" onAnswer={noop} onLater={noop} />
    </div>
  )
};

/** The sponsor call on the playable board: week 3, on day 3 Paula rings about the recession. */
export const SponsorCallOnBoard: StoryObj = {
  render: () => (
    <EngineProvider client={createMockClient({ seed: 1, startPeriod: 3 })}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <EngineBoard onPause={noop} onSettings={noop} />
      </div>
    </EngineProvider>
  )
};
