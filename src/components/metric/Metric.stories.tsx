import type { Meta, StoryObj } from '@storybook/react-vite';
import { KpiTile } from './KpiTile';
import { MetricBar } from './MetricBar';

const meta: Meta = { title: 'Components/Metric bar' };
export default meta;

/** Card rows share one 0 to 100 scale, so members compare at a glance. Under 30 turns amber and reads ", low". */
export const Bars: StoryObj = {
  render: () => (
    <div style={{ width: 186, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <MetricBar metric="skill" value={35} />
      <MetricBar metric="morale" value={9} />
      <MetricBar metric="result" value={37} />
      <MetricBar metric="trust" value={100} />
      <MetricBar metric="skill" value={0} />
    </div>
  )
};

export const BarPlayground: StoryObj<typeof MetricBar> = {
  render: args => <div style={{ width: 186 }}><MetricBar {...args} /></div>,
  args: { metric: 'morale', value: 57 },
  argTypes: { value: { control: { type: 'range', min: 0, max: 100 } }, metric: { control: 'inline-radio', options: ['skill', 'morale', 'result', 'trust'] } }
};

/** The metrics strip shows the engine's delta for 3 seconds after a change, then the trend word. */
export const KpiTiles: StoryObj = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 170px)', gap: 10 }}>
      <KpiTile metric="skill" value={57} trend={{ kind: 'delta', delta: 0.3 }} />
      <KpiTile metric="trust" value={56} trend={{ kind: 'delta', delta: -0.3 }} />
      <KpiTile metric="skill" value={57} trend={{ kind: 'direction', direction: 'up' }} />
      <KpiTile metric="trust" value={56} trend={{ kind: 'direction', direction: 'down' }} />
      <KpiTile metric="morale" value={57} trend={{ kind: 'direction', direction: 'flat' }} />
    </div>
  )
};
