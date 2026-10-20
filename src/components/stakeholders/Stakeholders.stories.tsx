import type { Meta, StoryObj } from '@storybook/react-vite';
import type { StakeholderView } from '../../engine/contract';
import { BusinessBar } from '../business/BusinessBar';
import { StakeholderBar, type StakeholderChip } from './StakeholderBar';
import { StakeholdersPanel } from './StakeholdersPanel';

/** Stakeholders outside the team on the board (D160 to D162), from the Client Trust demo storyline. */
const meta: Meta = { title: 'Board/Stakeholders', parameters: { layout: 'fullscreen' } };
export default meta;

const noop = () => {};
const CHIPS: StakeholderChip[] = [
  { key: 'client_lead', name: 'Priya Shah', img: null, level: 'good', request: { title: 'Priya asks for a call about the review', due: '1 day left' } },
  { key: 'cfo', name: 'Helen Brandt', img: null, level: 'cool', request: null },
  { key: 'delivery_lead', name: 'Elena Ruiz', img: null, level: 'steady', request: null }
];
const ITEMS = [{ key: 'budget', name: 'Budget', value: '$60K', dir: 'flat' as const, better: null, about: null, causes: [] }];

/** In the business row: the stakeholders' faces, ringed by how each relationship stands, and Priya's request with Answer. */
export const Bar: StoryObj = { render: () => <div style={{ paddingTop: 16 }}><BusinessBar items={ITEMS} decisions={[]} onDecide={noop} aside={<StakeholderBar items={CHIPS} onOpen={noop} onAnswer={noop} />} /></div> };
/** Tablet portrait width (D73): the row wraps. */
export const BarTablet: StoryObj = { render: () => <div style={{ width: 834, paddingTop: 16 }}><BusinessBar items={ITEMS} decisions={[]} onDecide={noop} aside={<StakeholderBar items={CHIPS} onOpen={noop} onAnswer={noop} />} /></div> };

const PRIYA: StakeholderView = {
  key: 'client_lead', name: 'Priya Shah', role: 'Head of Finance Operations, Halcyon Retail', kind: 'customer', pronoun: 'she', img: null,
  about: 'Leads Halcyon Retail\'s account, Northwind\'s largest client. She chose the platform and her reputation rides on the go live.',
  trust: 62, satisfaction: 58, start: { trust: 55, satisfaction: 60 }, level: 'good', mood: 'thinking',
  causes: [{ text: 'You chose "Hold the price and help them build the business case" for A deep discount to close this week.', trust: 5, satisfaction: 2 }, { text: 'Priya heard nothing from you this week.', trust: 0, satisfaction: -3 }],
  engaged: false, concern: null,
  interactions: [
    { key: 'checkin', type: 'meet', label: 'Meet Priya', kind: 'live', cost: 1, goal: 'Hear what Priya needs from the account team, and agree what happens next.', options: null, blocked: null },
    { key: 'update', type: 'email', label: 'Email Priya an update', kind: 'live', cost: 1, goal: 'Write Priya a clear update on the go live.', options: null, blocked: null },
    { key: 'scope', type: 'negotiate', label: 'Negotiate the go live scope', kind: 'live', cost: 1, goal: null, options: null, blocked: { reason: 'locked', period: 3 } }
  ],
  request: { id: 'q1', messageId: 'm1', kind: 'meeting', title: 'Priya asks for a call about the review', interaction: 'checkin', dueInSubPeriods: 1 }
};
const HELEN: StakeholderView = {
  key: 'cfo', name: 'Helen Brandt', role: 'Chief Financial Officer, Northwind Cloud', kind: 'executive', pronoun: 'she', img: null,
  about: 'Owns Northwind\'s budget. Generous with teams that show her the numbers early, hard on those that surprise her.',
  trust: 41, satisfaction: 44, start: { trust: 45, satisfaction: 46 }, level: 'cool', mood: 'concerned', causes: [], engaged: true,
  concern: 'The board wants a 10% cost cut next quarter and she has not told the business yet.',
  interactions: [
    { key: 'forecast', type: 'present', label: 'Present the forecast', kind: 'live', cost: 1, goal: 'Brief Helen on the quarter: the numbers, the biggest risk and what you need.', options: null, blocked: { reason: 'cooldown', in: 3 } },
    { key: 'contractor', type: 'negotiate', label: 'Ask for contractor budget', kind: 'static', cost: 1, goal: null, blocked: null,
      options: [{ key: 'ask', label: 'Ask for $20,000 for a contractor this quarter', detail: 'She says yes to teams she trusts.' }, { key: 'wait', label: 'Hold off until the numbers improve', detail: null }] }
  ],
  request: null
};
const why = (b: NonNullable<StakeholderView['interactions'][number]['blocked']>) => (b.reason === 'locked' ? `Unlocks in week ${b.period}` : b.reason === 'cooldown' ? 'Available again next week' : 'Not available now');

/** The panel: each relationship, what moved it, a request waiting, and what you can do now (a locked negotiation says when it opens). */
export const Panel: StoryObj = { render: () => <StakeholdersPanel stakeholders={[PRIYA, HELEN]} subPeriodUnit="day" busy={false} why={why} onEngage={async () => true} onAnswer={noop} onClose={noop} /> };
/** After the run: read only. */
export const PanelLocked: StoryObj = { render: () => <StakeholdersPanel stakeholders={[PRIYA, HELEN]} subPeriodUnit="day" busy={false} locked why={why} onEngage={async () => true} onAnswer={noop} onClose={noop} /> };
