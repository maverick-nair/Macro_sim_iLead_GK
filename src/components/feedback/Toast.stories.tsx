import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { Toast } from './Toast';

const meta: Meta = { title: 'Components/Toast' };
export default meta;

const Stage = ({ children, width = 900 }: { children: React.ReactNode; width?: number }) => (
  <div style={{ position: 'relative', width, height: 260, borderRadius: 16, border: '1px dashed var(--il-color-line-strong)' }}>{children}</div>
);

/** The bottom pill, as the app shows it after an action. */
export const Showing: StoryObj = { render: () => <Stage><Toast message="Report sent to your work email." /></Stage> };

/** Nothing showing: the status region stays mounted and draws nothing, so the next message is announced. */
export const Empty: StoryObj = { render: () => <Stage><Toast message={null} /></Stage> };

export const LongMessage: StoryObj = {
  render: () => <Stage><Toast message="Listening. Your words will appear in the box to edit, and you can change anything before it is saved to your development plan." /></Stage>
};

/** Tablet size, 834 wide (D69). */
export const Tablet: StoryObj = { render: () => <Stage width={834}><Toast message="Your PDF report is downloading." /></Stage> };

/** Fire it like the app does: each message replaces the last and clears after 3.4 seconds. */
export const Interactive: StoryObj = {
  render: function Render() {
    const [msg, setMsg] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const say = (m: string) => {
      clearTimeout(timer.current);
      setMsg(m);
      timer.current = setTimeout(() => setMsg(null), 3400);
    };
    return (
      <Stage>
        <div style={{ display: 'flex', gap: 8, padding: 16 }}>
          <button type="button" onClick={() => say('Report sent to your work email.')}>Email report</button>
          <button type="button" onClick={() => say('Replaying with captions.')}>Replay</button>
        </div>
        <Toast message={msg} />
      </Stage>
    );
  }
};
