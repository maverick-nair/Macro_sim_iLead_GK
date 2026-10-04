import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StyleKey } from '../../data/types';
import { MemberCard, TrustRing, type MemberCardProps } from './MemberCard';

const meta: Meta = { title: 'Components/Member card' };
export default meta;

const KENT: MemberCardProps = {
  name: 'Kent Goldberg', title: 'Senior Sales Development Rep', img: '/assets/npc/kent.png', mood: 'frustrated',
  skill: 35, morale: 9, result: 37, trust: 30, style: 'D', unread: true,
  onSelect: () => {}, onOpenProfile: () => {}, onStyleChange: () => {}
};
const MANDY: MemberCardProps = { ...KENT, name: 'Mandy Lobert', title: 'Account Qualifier', img: '/assets/npc/mandy.png', mood: 'neutral', skill: 50, morale: 61, result: 53, trust: 55, style: 'G', unread: false };
const BETH: MemberCardProps = { ...KENT, name: 'Beth Killiney', title: 'Sales Development Rep', img: '/assets/npc/beth.png', mood: 'happy', skill: 25, morale: 57, result: 32, trust: 48, unread: false, tags: ['New hire'] };
const PETER: MemberCardProps = { ...KENT, name: 'Peter Higgins', title: 'Account Qualifier', img: '/assets/npc/peter.png', mood: 'concerned', skill: 19, morale: 20, result: 26, trust: 24, unread: false, tags: ['Training'], away: true };
const GREEN: MemberCardProps = { ...KENT, name: 'Green Bell', title: 'Solutions Consultant', img: '/assets/npc/green.png', mood: 'happy', skill: 89, morale: 63, result: 78, trust: 70, style: 'P', unread: false, promise: 'Career talk due Friday' };
const RUTH: MemberCardProps = { ...KENT, name: 'Ruth Ether', title: 'Proposal Manager', img: '/assets/npc/ruth.png', mood: 'thinking', skill: 80, morale: 59, result: 83, trust: 64, style: 'P', unread: false };

/** Board columns are about 230px wide at 1440. The padding leaves room for the style tooltip above. */
const Col = ({ children, width = 230 }: { children: ReactNode; width?: number }) => <div style={{ width, paddingTop: 70, display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>;

/** A card with working selection and style state, as on the board. */
function Live(p: MemberCardProps) {
  const [selected, setSelected] = useState(!!p.selected);
  const [style, setStyle] = useState<StyleKey | null>(p.style);
  return <MemberCard {...p} selected={selected} style={style} onSelect={() => setSelected(s => !s)} onStyleChange={setStyle} />;
}

/** Click the card to select it; click a letter to change the style. Hover lifts the card, hovering a letter shows its meaning. */
export const Default: StoryObj = { render: () => <Col><Live {...MANDY} /></Col> };
export const Selected: StoryObj = { render: () => <Col><MemberCard {...KENT} selected /></Col> };

/** Tab to the card: the focus ring sits 3px outside the border. Tab again for the profile button, then the style letters (arrow keys move between them). */
function Focused() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('.il-select')?.focus({ focusVisible: true } as FocusOptions); }, []);
  return <div ref={ref}><Col><Live {...MANDY} /></Col></div>;
}
export const KeyboardFocus: StoryObj = { render: () => <Focused /> };

/** While picking people for an action, eligible cards stay full strength and a pick shows the check. */
export const PickingEligible: StoryObj = { render: () => <Col><MemberCard {...MANDY} /><MemberCard {...BETH} selected /></Col> };

/** Ineligible cards dim to 40%, show a not allowed cursor and give the reason on hover and to screen readers. */
export const PickingIneligible: StoryObj = {
  render: () => <Col><MemberCard {...PETER} unavailableReason="Away in training until Day 4" /><MemberCard {...BETH} unavailableReason="Same stage as Kent" /></Col>
};

/** Away in training: grey backdrop, greyscale portrait, "In training" pill. */
export const Away: StoryObj = { render: () => <Col><MemberCard {...PETER} /></Col> };

/** Values under 30 turn the bars and the trust ring amber. */
export const LowValues: StoryObj = { render: () => <Col><MemberCard {...PETER} away={false} trust={12} morale={0} /></Col> };
export const Unread: StoryObj = { render: () => <Col><MemberCard {...KENT} /></Col> };
export const PromiseDue: StoryObj = { render: () => <Col><MemberCard {...GREEN} /></Col> };
export const UnreadAndPromise: StoryObj = { render: () => <Col><MemberCard {...GREEN} unread /></Col> };
export const Tags: StoryObj = { render: () => <Col><MemberCard {...BETH} tags={['New hire', 'Rewarded', 'Mentor']} /></Col> };

/** Name and title truncate; tags wrap. */
export const LongText: StoryObj = {
  render: () => <Col width={190}><MemberCard {...RUTH} name="Alexandra Montgomery Whitfield" title="Principal Enterprise Proposal Manager, EMEA" tags={['New hire', 'Training', 'Career talk', 'Rewarded']} /></Col>
};

/** A style tooltip open on the first and the last letter: the tooltip lines up with the card edge. */
export const StyleTooltip: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <Col><MemberCard {...KENT} selected styleTooltip="G" /></Col>
      <Col><MemberCard {...MANDY} styleTooltip="E" /></Col>
    </div>
  )
};

/** Every mood: backdrop, dot color and pill. */
export const Moods: StoryObj = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 200px)', gap: 12, paddingTop: 70 }}>
      {(['happy', 'neutral', 'thinking', 'concerned', 'frustrated'] as const).map(mood => <MemberCard key={mood} {...MANDY} mood={mood} />)}
    </div>
  )
};

/** A stage column as on the board. */
export const Column: StoryObj = { render: () => <Col><Live {...KENT} /><Live {...BETH} /></Col> };

/** Narrow layout, as at 1280. */
export const Narrow: StoryObj = { render: () => <Col width={180}><Live {...GREEN} /></Col> };

/**
 * At 1024 wide a five stage board leaves each card about 108px. The trust ring moves up above the
 * mood pill instead of covering it, a pill wider than the card truncates (the full mood is in its
 * tooltip and the card's label), and the profile button moves under the name so the name keeps the
 * card's width.
 */
export const At1024: StoryObj = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 108px)', gap: 12, paddingTop: 70 }}>
      <MemberCard {...KENT} />
      <MemberCard {...PETER} />
      <MemberCard {...BETH} name="Alexandra Montgomery Whitfield" />
      <MemberCard {...MANDY} mood="frustrated" statsHidden />
    </div>
  )
};

/** Styles locked for the period: the letters stay focusable and say why, but picking does nothing. */
export const StyleLocked: StoryObj = {
  render: () => <Col><Live {...MANDY} styleDisabled styleDisabledReason="Styles are set until the next week." /></Col>
};

export const TrustRings: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      {[0, 12, 29, 30, 64, 100].map(v => <div key={v} style={{ position: 'relative', width: 50, height: 50, background: 'linear-gradient(160deg,#DEE9FF,#9FDCEB)', borderRadius: 8 }}><TrustRing value={v} /></div>)}
    </div>
  )
};

/** Before the profile is first opened (spec): no bars and no trust ring. No style chosen yet. */
export const StatsHidden: StoryObj = { render: () => <Col><Live {...MANDY} statsHidden style={null} /><Live {...KENT} /></Col> };
