import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ReasonChip, type ReasonChipProps } from './ReasonChip';
import { ReasonDetail } from './ReasonDetail';

const meta: Meta = { title: 'Components/Reason chip' };
export default meta;

const CHANGES: Array<Pick<ReasonChipProps, 'name' | 'metric' | 'delta'>> = [
  { name: 'Kent', metric: 'morale', delta: 8 },
  { name: 'Kent', metric: 'trust', delta: 6 },
  { name: 'Beth', metric: 'morale', delta: -2 }
];

function Chips() {
  const [nums, setNums] = useState(false);
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{CHANGES.map((c, i) => <ReasonChip key={i} {...c} showNumbers={nums} onToggle={() => setNums(n => !n)} />)}</div>;
}

/** Tap a chip to switch between words and exact numbers. */
export const Interactive: StoryObj = { render: () => <Chips /> };

export const AllStates: StoryObj = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, max-content)', gap: 8 }}>
      {CHANGES.flatMap((c, i) => [false, true].map(n => <ReasonChip key={`${i}${n}`} {...c} showNumbers={n} onToggle={() => {}} />))}
    </div>
  )
};

const WHY = {
  cause: 'You apologised, listened, and asked for Kent’s help instead of telling him what to do.',
  rule: 'A 1:1 that acknowledges a missed request and invites contribution lifts Morale 6 to 10 and Trust 4 to 8.',
  evidence: 'I’m sorry I missed it yesterday. I want to hear what’s on your mind, take your time.'
};

/** "See why" on the outcome panel: cause, authored rule and evidence. */
export const Why: StoryObj = { render: () => <div style={{ width: 640 }}><ReasonDetail {...WHY} judgedByAI /></div> };
export const WhyWithoutAI: StoryObj = { render: () => <div style={{ width: 640 }}><ReasonDetail {...WHY} judgedByAI={false} /></div> };
export const WhyNarrow: StoryObj = { render: () => <div style={{ width: 340 }}><ReasonDetail {...WHY} judgedByAI layout="stack" /></div> };
