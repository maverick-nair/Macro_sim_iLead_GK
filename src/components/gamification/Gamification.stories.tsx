import type { Meta, StoryObj } from '@storybook/react-vite';
import { BadgeAward, BadgeChip, BadgeShelf, type BadgeChipProps } from './Badge';
import { StarMeter, StarRow } from './StarMeter';

const meta: Meta = { title: 'Components/Badge and stars' };
export default meta;

const noop = () => {};

const LISTENER = (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7-6 6-6 10" />
    <path d="M9 8a3 3 0 0 1 6 0" />
    <circle cx="12" cy="21" r="1" />
  </svg>
);

const SHELF: BadgeChipProps[] = [
  { name: 'First word', status: 'earned', detail: 'Held your first live conversation' },
  { name: 'Listener', status: 'new', detail: 'Asked three open questions in one 1:1' },
  { name: 'Pipeline builder', status: 'locked', detail: 'Hint: push one stage past ideal' },
  { name: 'Steady hand', status: 'locked', detail: 'Hint: keep everyone above 40' },
  { name: 'A badge with an unusually long name', status: 'earned', detail: 'Long names stay on one line' }
];

/** Earned and newly earned show the medal; locked ones are muted and reveal only the hint on hover. */
export const Shelf: StoryObj = { render: () => <div style={{ width: 640 }}><BadgeShelf badges={SHELF} /></div> };
export const ShelfNarrow: StoryObj = { render: () => <div style={{ width: 340 }}><BadgeShelf badges={SHELF} /></div> };

export const Chips: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 10 }}>
      <BadgeChip name="First word" status="earned" detail="Held your first live conversation" />
      <BadgeChip name="Listener" status="new" detail="Asked three open questions in one 1:1" />
      <BadgeChip name="Clear voice" status="locked" detail="Hint: a whole week in voice" />
    </div>
  )
};

/** The week end popup for a newly earned badge, one at a time and skippable. */
export const Award: StoryObj<typeof BadgeAward> = {
  render: args => <BadgeAward {...args} />,
  args: { name: 'Listener', reason: 'You asked three open questions in your 1:1 with Kent before offering a fix.', icon: LISTENER, index: 1, total: 1, onSkip: noop, onContinue: noop }
};

export const AwardSecondOfThree: StoryObj = {
  render: () => <BadgeAward name="Steady hand" reason="Everyone on the team stayed above 40 morale for a whole week, even after the price cut news." icon={LISTENER} index={2} total={3} onSkip={noop} onContinue={noop} />
};

export const AwardNarrow: StoryObj = {
  render: () => <div style={{ width: 340 }}><BadgeAward name="Listener" reason="You asked three open questions in your 1:1 with Kent before offering a fix." icon={LISTENER} index={1} total={1} onSkip={noop} onContinue={noop} /></div>
};

/** The banner's stars rise in one after another. Several meters on one page keep their own gradients. */
export const Stars: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {[0, 1, 2, 3].map(n => <StarMeter key={n} earned={n} />)}
    </div>
  )
};

export const StarPlayground: StoryObj<typeof StarMeter> = {
  render: args => <StarMeter {...args} />,
  args: { earned: 2, total: 3 },
  argTypes: { earned: { control: { type: 'range', min: 0, max: 3 } } }
};

/** The weekly report rows: earned stars filled, the rest outlined and marked "not yet". */
export const ReportRows: StoryObj = {
  render: () => (
    <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StarRow kind="people" earned detail="Lifted team morale by 4 points" />
      <StarRow kind="leadership" earned detail="Matched your style to 7 of 10 people" />
      <StarRow kind="business" earned={false} detail="Hit week 2 revenue pace. You were $18,800 short." />
      <StarRow kind="people" earned={false} detail="Lift team morale by 3 points. A long explanation wraps under the title without pushing the star out of line." />
    </div>
  )
};
