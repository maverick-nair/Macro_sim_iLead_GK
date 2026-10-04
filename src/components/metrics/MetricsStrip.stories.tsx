import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MoneyProvider } from '../../i18n/money';
import { MetricsStrip, SPONSOR_LEVELS, type MetricsStripProps, type SponsorLevel } from './MetricsStrip';

const meta: Meta<typeof MetricsStrip> = { title: 'Components/Metrics strip', component: MetricsStrip };
export default meta;
type Story = StoryObj<typeof MetricsStrip>;

const noop = () => {};
const sized = (height?: number): Pick<Story, 'decorators'> => ({ decorators: [S => <div style={{ width: 1440, height }}><S /></div>] });

/** The board's own values: Week 2 of the Sales Elevator. */
const base: MetricsStripProps = {
  kpis: [
    { metric: 'skill', value: 57, trend: { kind: 'delta', delta: 0.3 } },
    { metric: 'morale', value: 49, trend: { kind: 'delta', delta: 0 } },
    { metric: 'result', value: 44, trend: { kind: 'delta', delta: 0.6 } },
    { metric: 'trust', value: 56, trend: { kind: 'delta', delta: -0.3 } }
  ],
  pulse: { upbeat: 4, steady: 3, struggling: 3 },
  target: { value: 41200, target: 240000, pace: 0.25, pacePeriod: { unit: 'week', n: 2 } },
  sponsor: {
    level: 'steady', open: false, onToggle: noop,
    causes: [{ text: 'Ashcroft moved to proposal', delta: 1 }, { text: 'Revenue is behind week 2 pace', delta: -1 }, { text: "No reply yet to Priya's email", delta: -1 }]
  }
};
const sponsor = (s: Partial<MetricsStripProps['sponsor']>) => ({ ...base.sponsor, ...s });
const target = (value: number) => ({ ...base.target, value });

export const Default: Story = { ...sized(), args: base };

/** After the 3 second delta window, each KPI shows its direction word. */
export const KpiDirections: Story = {
  ...sized(),
  args: { ...base, kpis: [
    { metric: 'skill', value: 57, trend: { kind: 'direction', direction: 'up' } },
    { metric: 'morale', value: 9, trend: { kind: 'direction', direction: 'flat' } },
    { metric: 'result', value: 100, trend: { kind: 'direction', direction: 'up' } },
    { metric: 'trust', value: 22, trend: { kind: 'direction', direction: 'down' } }
  ] }
};

/** Large deltas right after a change. */
export const KpiDeltas: Story = {
  ...sized(),
  args: { ...base, kpis: [
    { metric: 'skill', value: 64, trend: { kind: 'delta', delta: 7 } },
    { metric: 'morale', value: 41, trend: { kind: 'delta', delta: -8 } },
    { metric: 'result', value: 50, trend: { kind: 'delta', delta: 1.5 } },
    { metric: 'trust', value: 0, trend: { kind: 'delta', delta: -12 } }
  ] }
};

/** Every sponsor level: the meter fills one segment per level. */
export const SponsorLevels: StoryObj = {
  render: () => (
    <div style={{ width: 1440, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {SPONSOR_LEVELS.map((level: SponsorLevel) => <MetricsStrip key={level} {...base} sponsor={sponsor({ level })} />)}
    </div>
  )
};

/** "Recent causes" open. Cause lines are engine text; the arrow follows the sign. */
export const SponsorCausesOpen: Story = { ...sized(260), args: { ...base, sponsor: sponsor({ open: true, causes: [...base.sponsor.causes, { text: 'Weekly update sent on time, no change', delta: 0 }] }) } };

/** Click the sponsor tile to toggle the popover. */
export const SponsorInteractive: StoryObj = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return <div style={{ width: 1440, height: 260 }}><MetricsStrip {...base} sponsor={sponsor({ open, onToggle: () => setOpen(o => !o) })} /></div>;
  }
};

/** Empty groups drop out of the bar and the counts. */
export const PulseWithEmptyGroup: Story = { ...sized(), args: { ...base, pulse: { upbeat: 6, steady: 0, struggling: 4 } } };

export const PulseAllUpbeat: Story = { ...sized(), args: { ...base, pulse: { upbeat: 10, steady: 0, struggling: 0 } } };

export const TargetZero: Story = { ...sized(), args: { ...base, target: target(0) } };

export const TargetSixtyPercent: Story = { ...sized(), args: { ...base, target: target(144000) } };

/** Over target: the bar stays full. */
export const TargetOverAchieved: Story = { ...sized(), args: { ...base, target: target(288000) } };

/** Storyline currency from the GenieKreator config. */
export const PoundSterling: Story = {
  decorators: [S => <div style={{ width: 1440 }}><MoneyProvider money={{ currency: 'GBP', locale: 'en-GB', display: 'symbol' }}><S /></MoneyProvider></div>],
  args: { ...base, target: { ...base.target, label: 'Quarter target', value: 31800, target: 185000 } }
};

/** JPY has no decimals and large numbers. */
export const Yen: Story = {
  decorators: [S => <div style={{ width: 1440 }}><MoneyProvider money={{ currency: 'JPY', locale: 'ja-JP', display: 'symbol' }}><S /></MoneyProvider></div>],
  args: { ...base, target: { ...base.target, value: 6180000, target: 36000000 } }
};

/** INR groups in lakhs and crores. */
export const Rupee: Story = {
  decorators: [S => <div style={{ width: 1440 }}><MoneyProvider money={{ currency: 'INR', locale: 'en-IN', display: 'symbol' }}><S /></MoneyProvider></div>],
  args: { ...base, target: { ...base.target, value: 3420000, target: 20000000 } }
};

/** A custom target heading from the storyline. */
export const CustomTargetLabel: Story = { ...sized(), args: { ...base, target: { ...base.target, label: 'Annual bookings' } } };
