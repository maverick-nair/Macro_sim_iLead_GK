import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from '../ds/Switch';

const meta: Meta<typeof Switch> = { title: 'Components/Switch', component: Switch, args: { label: 'Captions on every NPC voice line' } };
export default meta;

export const Off: StoryObj<typeof Switch> = { args: { checked: false } };
export const On: StoryObj<typeof Switch> = { args: { checked: true } };
export const Disabled: StoryObj<typeof Switch> = { args: { checked: true, disabled: true } };
