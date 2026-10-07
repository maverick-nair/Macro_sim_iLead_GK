import type { Meta, StoryObj } from '@storybook/react-vite';
import { PracticeOffer } from './PracticeOffer';

/** The Week 0 practice offer above week 1's style setting (D16, D84). */
const meta: Meta<typeof PracticeOffer> = { title: 'Board/Practice offer', component: PracticeOffer, args: { name: 'Kent', onStart: () => {}, onSkip: () => {} } };
export default meta;

export const Offered: StoryObj<typeof PracticeOffer> = {};
/** While the practice opens: both buttons wait. */
export const Busy: StoryObj<typeof PracticeOffer> = { args: { busy: true } };
/** Tablet portrait width (D73): the buttons wrap under the text. */
export const Tablet: StoryObj<typeof PracticeOffer> = { render: args => <div style={{ width: 744 }}><PracticeOffer {...args} /></div> };
