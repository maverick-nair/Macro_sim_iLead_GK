import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { SmallScreenNotice } from './SmallScreenNotice';

const meta: Meta = { title: 'Shell/Small screen notice', parameters: { layout: 'fullscreen' } };
export default meta;

const LINK = 'https://ilead.example/play?participant=p1';
const copied = () => Promise.resolve(true);
const refused = () => Promise.resolve(false);

/**
 * A phone, as the app shows it (D69). The transform makes the frame the containing block of the
 * notice (position fixed), so it fills the frame instead of the canvas.
 */
const Phone = ({ width = 390, height = 844, children }: { width?: number; height?: number; children: ReactNode }) => (
  <div style={{ width, height, transform: 'translateZ(0)', overflow: 'hidden', border: '1px solid var(--il-color-line-default)' }}>{children}</div>
);

/** A 390 by 844 phone held upright. Copy link copies; the status says so. Use the toolbar for light and the client theme. */
export const Portrait: StoryObj = { render: () => <Phone><SmallScreenNotice link={LINK} copy={copied} focusOnOpen={false} /></Phone> };

/** Held sideways, 844 by 390: shorter than 500 on a touch screen. The notice scrolls on its own. */
export const Landscape: StoryObj = { render: () => <Phone width={844} height={390}><SmallScreenNotice link={LINK} copy={copied} focusOnOpen={false} /></Phone> };

/** The browser refused the clipboard: the status says to copy the address instead. */
export const CopyRefused: StoryObj = { render: () => <Phone><SmallScreenNotice link={LINK} copy={refused} focusOnOpen={false} /></Phone> };

/** The client theme's logo slot beside the iLead mark (pick Client in the toolbar for its accent). */
export const ClientLogo: StoryObj = { render: () => <Phone><SmallScreenNotice link={LINK} copy={copied} clientLogo focusOnOpen={false} /></Phone> };

/** The narrowest phones, 320 wide. */
export const Narrow: StoryObj = { render: () => <Phone width={320} height={640}><SmallScreenNotice link={LINK} copy={copied} focusOnOpen={false} /></Phone> };
