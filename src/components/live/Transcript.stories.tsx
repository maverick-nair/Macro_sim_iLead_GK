import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { LiveCaption } from './LiveCaption';
import { TranscriptBubble } from './TranscriptBubble';

const meta: Meta = { title: 'Components/Transcript bubble' };
export default meta;

const KENT = 'You said you would look at the territory split last week. I waited all day.';
const YOU = 'I’m sorry I missed it yesterday. I want to hear what’s on your mind, take your time.';
const LONG = 'Honestly, it is not just the split. Beth took over three of my oldest accounts and nobody asked me, and now the CRM says I am behind on every one of them, which is not true, I just have not had time to log the calls because I am covering for two people.';

const Panel = ({ children, width = 420 }: { children: React.ReactNode; width?: number }) => (
  <div style={{ width, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 22, background: 'var(--il-color-surface-card)', border: '1px solid var(--il-color-line-default)' }}>{children}</div>
);

/** NPC turns carry the speaker's name, the visible AI persona label and Replay. Your turns sit right on the brand fill. */
export const Conversation: StoryObj = {
  render: () => (
    <Panel>
      <TranscriptBubble speaker="npc" name="Kent" text={KENT} onReplay={() => {}} />
      <TranscriptBubble speaker="you" text={YOU} />
      <TranscriptBubble speaker="npc" name="Kent" text="Okay. That would actually help." onReplay={() => {}} />
    </Panel>
  )
};

export const NpcTurn: StoryObj<typeof TranscriptBubble> = {
  render: args => <Panel><TranscriptBubble {...args} /></Panel>,
  args: { speaker: 'npc', name: 'Kent', text: KENT, onReplay: () => {} }
};

export const NpcWithoutReplay: StoryObj = { render: () => <Panel><TranscriptBubble speaker="npc" name="Green" text="Ashcroft is close, but procurement wants twelve percent off." /></Panel> };
export const YourTurn: StoryObj = { render: () => <Panel><TranscriptBubble speaker="you" text={YOU} /></Panel> };
export const LongText: StoryObj = { render: () => <Panel><TranscriptBubble speaker="npc" name="Kent" text={LONG} onReplay={() => {}} /><TranscriptBubble speaker="you" text={LONG} /></Panel> };
export const Narrow: StoryObj = { render: () => <Panel width={340}><TranscriptBubble speaker="npc" name="Kent" text={KENT} onReplay={() => {}} /><TranscriptBubble speaker="you" text={YOU} /></Panel> };

function useStream(line: string, ms = 120) {
  const words = line.split(' ');
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN(x => (x >= words.length + 8 ? 0 : x + 1)), ms);
    return () => clearInterval(id);
  }, [words.length, ms]);
  return { text: words.slice(0, n).join(' '), streaming: n < words.length };
}

/** The NPC line streams into the caption and the last bubble together; the caret blinks until it ends. */
export const Streaming: StoryObj = {
  render: function Render() {
    const { text, streaming } = useStream(KENT);
    return (
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <LiveCaption name="Kent" text={text} streaming={streaming} />
        <Panel><TranscriptBubble speaker="you" text={YOU} /><TranscriptBubble speaker="npc" name="Kent" text={text} streaming={streaming} onReplay={() => {}} /></Panel>
      </div>
    );
  }
};

/** Captions under the 1:1 portrait, the smaller interview size, the meeting grid and the sponsor avatar. */
export const Captions: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 620 }}>
      <LiveCaption name="Kent" text={KENT} />
      <LiveCaption name="Kent" text={KENT} streaming />
      <div style={{ width: 340 }}><LiveCaption name="Kent" text={KENT} size="md" /></div>
      <LiveCaption variant="panel" name="Green" text="Ashcroft is close, but procurement wants twelve percent off." />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><LiveCaption variant="panel" centered name="Priya" text="Thanks for joining. Walk me through where the pipeline stands." /></div>
      <LiveCaption name="Kent" text="" />
    </div>
  )
};
