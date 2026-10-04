import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import type { EngineView, MetricChange } from '../../engine/contract';
import { EngineProvider } from '../../engine/react';
import { play } from '../../engine/sim/policies';
import { createMockClient, defaultStoryline } from '../../engine/mock';
import { EngineBoard } from './EngineBoard';
import { EventCard } from './EventCard';
import { PeriodPanel } from './PeriodPanel';

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

/** The results panel at the end of the run, from a real run of the good policy. The week end has its own stories (`Week end`). */
function RunEndedPanel() {
  const [view, setView] = useState<EngineView | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await play(defaultStoryline(), 'good', 3);
      setView(r.view as unknown as EngineView);
    })();
  }, []);
  return view ? <PeriodPanel view={view} money={n => `$${Math.round(n).toLocaleString('en-US')}`} onClose={noop} /> : null;
}
export const RunEnded: StoryObj = { render: () => <RunEndedPanel /> };
