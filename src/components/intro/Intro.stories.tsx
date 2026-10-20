import type { Meta, StoryObj } from '@storybook/react-vite';
import { parseStoryline } from '../../engine/config';
import type { EngineView } from '../../engine/contract';
import { storylineLook } from '../../engine/sim/view';
import salesElevator from '../../engine/storylines/sales-elevator.json';
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
/** Sales Elevator's portfolio (D221) as the view carries it: code, kind, tagline, who it is for, typical deal, photo and its description, four features placed on the photo. */
const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const PRODUCTS = storylineLook(parsed.config).products;
/** A storyline from before D221: names, lines and specs only; the first four specs are the features, spots evenly placed. */
const PLAIN = [
  { name: 'Levo B10', line: 'Commercial', specs: ['A quiet, smooth ride in busy lobbies', 'Fits the shafts older buildings already have', 'Facilities managers who hate downtime', 'Lead with the service contract, not the cab', 'Rated load 1,000 kg'], image: null },
  { name: 'Levo H4', line: 'Residential', specs: ['Quiet enough for home', 'A small footprint'], image: null }
];
const view = (products: unknown[] = PRODUCTS) => ({
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
const flow = (start: IntroScreen, products: unknown[] = PRODUCTS) => (
  <IntroFlow view={view(products)} letter={LETTER} start={start} noticeAfter={0} autoPlay={false} onLogOut={noop} onStart={noop} onVoice={noop} onText={noop} />
);

/** The landing with the sponsor's notification in. */
export const Landing: Story = { render: () => flow('landing') };
/** The sponsor's message, paused at its start, captions on. */
export const Message: Story = { render: () => flow('message') };
/** The portfolio: Sales Elevator's four models with their photos and placed features, the first explored. */
export const Products: Story = { render: () => flow('products') };
/** A portfolio from before D221 (no codes, kinds or features): the specs stand in, as the player falls back. */
export const ProductsWithoutFeatures: Story = { render: () => flow('products', PLAIN) };
/** The objectives; Start simulation shows after five seconds (at once with reduced motion). */
export const Objectives: Story = { render: () => flow('objectives') };
/** A storyline without a portfolio: the message ends on the objectives. */
export const MessageWithoutProducts: Story = { render: () => flow('message', []) };
