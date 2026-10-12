import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EngineView } from '../../engine/contract';
import { IntroFlow, type IntroScreen } from './IntroFlow';

/**
 * The pre-game flow (D219): landing, the sponsor's message, the product portfolio and the objectives. The values
 * stand in for an engine view with the storyline contract's portfolio (D182); in play they come from the storyline.
 */
const meta: Meta = { title: 'Onboarding/Pre-game flow', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const noop = () => {};
const members = ['kent', 'beth', 'justin', 'derick', 'green', 'lowe', 'jack', 'peter', 'ruth', 'mandy'].map(id => ({ id, name: id[0].toUpperCase() + id.slice(1), img: `/assets/npc/${id}.png` }));
const PRODUCTS = [
  { name: 'Levo B10', line: 'Commercial', specs: ['A quiet, smooth ride in busy lobbies', 'Fits the shafts older buildings already have', 'Facilities managers who hate downtime', 'Lead with the service contract, not the cab', 'Rated load 1,000 kg', 'Speed 1.6 m/s', 'Travel up to 60 m', 'Typical deal $42K'], image: null },
  { name: 'Levo H4', line: 'Residential', specs: ['Quiet enough for home', 'A small footprint', 'Families, for an older parent', 'Talk safety and independence before finishes'], image: null },
  { name: 'Levo P20', line: 'Panoramic', specs: ['Glass on three sides', 'A showpiece for hotels'], image: null },
  { name: 'Levo C30', line: 'Service and freight', specs: ['Built for pallets', 'Hard wearing floor'], image: null }
];
const view = (products = PRODUCTS) => ({
  sponsor: { name: 'Paula Jacob', title: 'Regional Sales Director', img: null, styleLine: 'To each their own. Your people need different things from you this week.' },
  storyline: { name: 'Sales Elevator', organisation: 'Innov8 Elevators', locale: 'en', video: null, products },
  clock: { period: 1, periods: 8, periodUnit: 'week', subPeriod: 1, subPeriodUnit: 'day', capacity: 5, capacityLeft: 5, costStep: 0.5, runShare: 0 },
  money: { currency: 'USD', locale: 'en-US', display: 'symbol', target: 240000, value: 0, valueThisPeriod: 0 },
  members, liveCap: { cap: 2, used: 0 },
  gamification: { weights: { business: 0.3, people: 0.3, leadership: 0.4 } }
}) as unknown as EngineView;
const LETTER = {
  welcome: ['Welcome to Innov8 Elevators. I am glad you are here.', 'You are taking over a team of ten.'],
  product: ['Deals move through five stages.'],
  targets: ['Reach $240,000 in revenue over eight weeks.']
};
const flow = (start: IntroScreen, products = PRODUCTS) => (
  <IntroFlow view={view(products)} letter={LETTER} start={start} noticeAfter={0} autoPlay={false} onLogOut={noop} onStart={noop} onVoice={noop} onText={noop} />
);

/** The landing with the sponsor's notification in. */
export const Landing: Story = { render: () => flow('landing') };
/** The sponsor's message, paused at its start, captions on. */
export const Message: Story = { render: () => flow('message') };
/** The portfolio: four models, the first explored. */
export const Products: Story = { render: () => flow('products') };
/** The objectives; Start simulation shows after five seconds (at once with reduced motion). */
export const Objectives: Story = { render: () => flow('objectives') };
/** A storyline without a portfolio: the message ends on the objectives. */
export const MessageWithoutProducts: Story = { render: () => flow('message', []) };
