import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../ds/Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'End week', variant: 'primary', size: 'md', disabled: false },
  argTypes: { variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] }, size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } }
};
export default meta;

export const Playground: StoryObj<typeof Button> = {};

export const AllVariants: StoryObj<typeof Button> = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, max-content)', gap: 16, alignItems: 'center' }}>
      {(['primary', 'secondary', 'ghost'] as const).flatMap(variant => [
        ...(['sm', 'md', 'lg'] as const).map(size => <Button key={variant + size} variant={variant} size={size}>Confirm</Button>),
        <Button key={variant + 'off'} variant={variant} disabled>Disabled</Button>
      ])}
    </div>
  )
};
