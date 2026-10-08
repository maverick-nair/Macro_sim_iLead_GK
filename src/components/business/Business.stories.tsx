import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { EngineView } from '../../engine/contract';
import { BusinessBar, type BusinessItem } from './BusinessBar';
import { DecisionDialog } from './DecisionDialog';

/** The business on the board and choice events (D136, D137), from the Client Trust demo storyline. */
const meta: Meta = { title: 'Board/Business and decisions', parameters: { layout: 'fullscreen' } };
export default meta;

const noop = () => {};
const ITEMS: BusinessItem[] = [
  { key: 'budget', name: 'Budget', value: '$45K', dir: 'down', better: false, about: 'What you can spend this quarter beyond salaries: training, team events, contractors and hires.',
    causes: [{ text: 'Release crunch: Bring in a contractor for two weeks', change: '−$20K', dir: 'down' }, { text: 'Finance wants a cut: Cut the training budget', change: '+$15K', dir: 'up' }] },
  { key: 'customer_trust', name: 'Customer trust', value: '74%', dir: 'up', better: true, about: 'How much your clients trust Northwind to keep its promises.', causes: [] },
  { key: 'quality', name: 'Product quality', value: '59', dir: 'flat', better: null, about: null, causes: [] }
];

/** Three variables and a decision still waiting, on the board's width. */
export const Bar: StoryObj = { render: () => <div style={{ paddingTop: 16 }}><BusinessBar items={ITEMS} decisions={[{ id: 'c1', title: 'Rumors of a merger', due: '1 day left' }]} onDecide={noop} /></div> };
/** Tablet portrait width (D73): the items wrap. */
export const BarTablet: StoryObj = { render: () => <div style={{ width: 834, paddingTop: 16 }}><BusinessBar items={ITEMS} decisions={[{ id: 'c1', title: 'Rumors of a merger', due: '1 day left' }]} onDecide={noop} /></div> };

const CHOICE: EngineView['openChoices'][number] = {
  id: 'c1', eventKey: 'discount_deal', card: 'opportunity', title: 'A deep discount to close this week', memberId: 'owen',
  body: 'Owen can close a large client this week, but only with a 25% discount the client did not ask for until Owen offered it.',
  known: ['The client\'s budget year ends on Friday.', 'Your sponsor wants this quarter\'s number.'],
  options: [
    { key: 'discount', label: 'Approve the discount and close this week', detail: null },
    { key: 'value', label: 'Hold the price and help them build the business case', detail: null },
    { key: 'walk', label: 'Let it go and focus on the next deal', detail: null }
  ],
  dueInSubPeriods: 2
};
const RESULT: EngineView['choices'][number] = {
  id: 'c1', eventKey: 'discount_deal', title: CHOICE.title, option: 'value', label: 'Hold the price and help them build the business case', by: 'you',
  outcome: 'Owen goes back with a business case instead of a discount. The client asks for a week.', period: 2, sub: 2, changes: [], variables: [{ key: 'customer_trust', name: 'Customer trust', delta: 4 }], revenue: 0,
  triggered: []
};
const lines = () => ['Owen morale −2', 'Owen trust +2', 'Customer trust +4%'];

function Deciding() {
  const [result, setResult] = useState<typeof RESULT | null>(null);
  return <DecisionDialog choice={CHOICE} result={result} busy={false} img="/assets/npc/jack.webp" due="2 days left" changes={lines} onDecide={() => setResult(RESULT)} onLater={noop} onDone={() => setResult(null)} />;
}
/** The decision: what you know, the options, Decide or Decide later. */
export const Decision: StoryObj = { render: () => <Deciding /> };
/** After deciding: what happened and what it changed. */
export const DecisionOutcome: StoryObj = { render: () => <DecisionDialog choice={CHOICE} result={RESULT} busy={false} img="/assets/npc/jack.webp" due="2 days left" changes={lines} onDecide={noop} onLater={noop} onDone={noop} /> };
/** Left to the default: the deadline passed. */
export const DecisionDefault: StoryObj = { render: () => <DecisionDialog choice={CHOICE} result={{ ...RESULT, by: 'default', option: 'discount', label: 'Approve the discount and close this week', outcome: 'The deal closes. The client now expects a discount every time.' }} busy={false} due="" changes={() => ['Revenue +$15K', 'Customer trust −6%']} onDecide={noop} onLater={noop} onDone={noop} /> };
