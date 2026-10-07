import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { StyleKey } from '../../data/types';
import type { MemberCardProps } from '../member/MemberCard';
import { TeamBoard, type StageColumn, type TeamBoardHint, type TeamBoardProps } from './TeamBoard';

const meta: Meta = { title: 'Components/Team board' };
export default meta;

const noop = () => {};
type Card = MemberCardProps & { id: string };
const person = (id: string, name: string, title: string, p: Partial<MemberCardProps>): Card => ({
  id, name, title, img: `/assets/npc/${id}.png`, mood: 'neutral', skill: 50, morale: 50, result: 50, trust: 50, style: 'G',
  onSelect: noop, onOpenProfile: noop, onStyleChange: noop, ...p
});

const KENT = person('kent', 'Kent Goldberg', 'Senior Sales Development Rep', { mood: 'frustrated', skill: 35, morale: 9, result: 37, trust: 30, style: 'D', unread: true });
const BETH = person('beth', 'Beth Killiney', 'Sales Development Rep', { mood: 'happy', skill: 25, morale: 57, result: 32, trust: 48, style: 'D', tags: ['New hire'] });
const MANDY = person('mandy', 'Mandy Lobert', 'Account Qualifier', { skill: 50, morale: 61, result: 53, trust: 55 });
const PETER = person('peter', 'Peter Higgins', 'Account Qualifier', { mood: 'concerned', skill: 19, morale: 20, result: 26, trust: 24, style: 'D', tags: ['Training'], away: true });
const GREEN = person('green', 'Green Bell', 'Solutions Consultant', { mood: 'happy', skill: 89, morale: 63, result: 78, trust: 70, style: 'P', promise: 'Career talk due Friday' });
const LOWE = person('lowe', 'Lowe Rex', 'Solutions Consultant', { mood: 'concerned', skill: 80, morale: 45, result: 77, trust: 52, style: 'P' });
const RUTH = person('ruth', 'Ruth Ether', 'Proposal Manager', { mood: 'thinking', skill: 80, morale: 59, result: 83, trust: 64, style: 'P' });
const JUSTIN = person('justin', 'Justin Keel', 'Proposal Writer', { mood: 'happy', skill: 26, morale: 84, result: 37, trust: 60, style: 'E' });
const JACK = person('jack', 'Jack Holt', 'Account Executive', { mood: 'happy', skill: 92, morale: 83, result: 83, trust: 82, style: 'E' });
const DERICK = person('derick', 'Derick Kaynes', 'Account Executive', { mood: 'happy', skill: 70, morale: 85, result: 81, trust: 77, style: 'E' });

const col = (key: string, name: string, count: number, ideal: number, cards: Card[], bottleneck = false): StageColumn => ({ key, name, count, ideal, bottleneck, cards });

/** The Sales Elevator funnel, Qualification is the bottleneck (frame b1). */
const FIVE: StageColumn[] = [
  col('lead', 'Lead generation', 42, 40, [KENT, BETH]),
  col('qual', 'Qualification', 18, 24, [MANDY, PETER], true),
  col('demo', 'Solution demo', 9, 14, [GREEN, LOWE]),
  col('prop', 'Proposal', 6, 8, [RUTH, JUSTIN]),
  col('close', 'Closing', 3, 5, [JACK, DERICK])
];
const THREE: StageColumn[] = [
  col('find', 'Find', 30, 30, [KENT, BETH, MANDY]),
  col('pitch', 'Pitch', 8, 16, [GREEN, LOWE, RUTH], true),
  col('win', 'Win', 6, 6, [JACK, DERICK])
];
const SIX: StageColumn[] = [
  col('lead', 'Lead generation', 42, 40, [KENT, BETH]),
  col('qual', 'Qualification', 18, 24, [MANDY, PETER]),
  col('demo', 'Solution demo', 9, 14, [GREEN, LOWE]),
  col('prop', 'Proposal', 6, 8, [RUTH], true),
  col('neg', 'Negotiation', 4, 6, [JUSTIN]),
  col('close', 'Closing', 3, 5, [JACK, DERICK])
];

/** The board's width at 1440: 1440 minus the 64px rail and the 330px actions panel. */
const Frame = (p: Partial<TeamBoardProps> & { width?: number }) => (
  <div style={{ width: p.width ?? 1046, paddingTop: 8 }}>
    <TeamBoard hint={{ kind: 'idle' }} legendOpen={false} onToggleLegend={noop} periodUnit="week" columns={FIVE} {...p} />
  </div>
);

/** Selection and the legend work: click a card to select it, the button opens the legend. */
function Live({ columns }: { columns: StageColumn[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);
  const [styles, setStyles] = useState<Record<string, StyleKey>>({});
  const all = columns.flatMap(c => c.cards);
  const live = columns.map(c => ({ ...c, cards: c.cards.map(m => ({ ...m, selected: sel === m.id, style: styles[m.id] ?? m.style,
    onSelect: () => setSel(x => (x === m.id ? null : m.id)), onStyleChange: (k: StyleKey) => setStyles(x => ({ ...x, [m.id]: k })) })) }));
  const hint: TeamBoardHint = sel ? { kind: 'selected', name: all.find(m => m.id === sel)?.name ?? '' } : { kind: 'idle' };
  return <Frame columns={live} hint={hint} legendOpen={legend} onToggleLegend={() => setLegend(x => !x)} />;
}

export const FiveStages: StoryObj = { render: () => <Live columns={FIVE} /> };
/** Three stages: the grid follows the data, so the columns widen. */
export const ThreeStages: StoryObj = { render: () => <Frame columns={THREE} /> };
/** Six stages is the most a storyline has; the bottleneck sits on a middle stage. */
export const SixStages: StoryObj = { render: () => <Frame columns={SIX} /> };
/** Six stages at 1280 wide, the narrowest desktop board. */
export const SixStagesAt1280: StoryObj = { render: () => <Frame columns={SIX} width={886} /> };
/** Five stages at 1024 wide (1024 minus the rail and the actions panel): trust rings sit above the mood pills, profile buttons under the names. */
export const FiveStagesAt1024: StoryObj = { render: () => <Frame columns={FIVE} width={630} /> };

/** Frame b2: Kent selected. */
export const Selected: StoryObj = {
  render: () => <Frame hint={{ kind: 'selected', name: 'Kent Goldberg' }} columns={FIVE.map((c, i) => (i === 0 ? { ...c, cards: [{ ...KENT, selected: true }, BETH] } : c))} />
};

/** Picking people for an action: picked cards are selected, Peter is away and cannot take part. */
export const Picking: StoryObj = {
  render: () => <Frame hint={{ kind: 'picking' }} columns={FIVE.map(c => ({ ...c, cards: c.cards.map(m => (
    m.id === 'peter' ? { ...m, unavailableReason: 'Away in training until Day 4' } : ['mandy', 'justin'].includes(m.id) ? { ...m, selected: true } : m)) }))} />
};

/** Frame b8: the style legend open. */
export const LegendOpen: StoryObj = { render: () => <Frame legendOpen /> };

/** A month based storyline: "Bottleneck this month", "Each month you choose". */
export const MonthStoryline: StoryObj = { render: () => <Frame periodUnit="month" legendOpen /> };

/** A stage nobody works in: just its header. */
export const EmptyColumn: StoryObj = {
  render: () => <Frame columns={FIVE.map(c => (c.key === 'prop' ? { ...c, count: 0, cards: [] } : c))} />
};

/** A long stage name truncates in its header. */
export const LongStageName: StoryObj = {
  render: () => <Frame columns={FIVE.map(c => (c.key === 'demo' ? { ...c, name: 'Technical solution demonstration' } : c))} />
};

/** Stage info (D97): each header's info button opens what the stage does and which skills suit it; Results and stages opens the overviews (D96). */
export const StageInfo: StoryObj = {
  render: () => <Frame onOverview={() => undefined} columns={FIVE.map((c, i) => ({ ...c, about: 'Finds new prospects and makes first contact, so the funnel always has buyers to talk to.', suits: i % 2 ? 'Prospecting and resilience after a no.' : null }))} />
};
