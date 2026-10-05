import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { MicButton, RecordAgainButton, type MicState } from './MicButton';
import { MicHint, MicStatus, type MicHintInput, type MicStatusKind } from './MicStatus';
import { Waveform } from './Waveform';

const meta: Meta = { title: 'Components/Mic control' };
export default meta;

const noop = () => {};
const STATIC_LEVELS = [4, 12, 22, 30, 18, 9, 26, 34, 14, 6, 20, 28, 10, 16, 32, 24, 8, 12, 22, 18, 6, 14, 26, 10];

function useLevels(on: boolean) {
  const [levels, setLevels] = useState(STATIC_LEVELS);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setLevels(l => l.map(() => 4 + Math.round(Math.random() * 30))), 100);
    return () => clearInterval(id);
  }, [on]);
  return levels;
}

const Label = ({ children }: { children: React.ReactNode }) => <span style={{ fontSize: 12, color: 'var(--il-color-fg-secondary)' }}>{children}</span>;

/** Every mic state: voice idle and review, listening (ring and glow), text mode, and blocked. Voice 60, text 48. */
export const AllStates: StoryObj = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, max-content)', gap: 28, alignItems: 'center', padding: 16 }}>
      {([['idle', 'voice', 'Voice, ready'], ['review', 'voice', 'Voice, review'], ['listening', 'voice', 'Listening'], ['idle', 'text', 'Text mode'], ['denied', 'text', 'Mic blocked'], ['denied', 'voice', 'Blocked in voice']] as Array<[MicState, 'voice' | 'text', string]>).map(([state, mode, label]) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <MicButton state={state} mode={mode} onPress={noop} />
          <Label>{label}</Label>
        </div>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <RecordAgainButton onPress={noop} />
        <Label>Record again</Label>
      </div>
    </div>
  )
};

export const Playground: StoryObj<typeof MicButton> = {
  render: args => <div style={{ padding: 16 }}><MicButton {...args} /></div>,
  args: { state: 'idle', mode: 'voice', onPress: noop },
  argTypes: { state: { control: 'inline-radio', options: ['idle', 'listening', 'review', 'denied'] }, mode: { control: 'inline-radio', options: ['voice', 'text'] } }
};

/** Tap to listen, tap again to stop and review, as the reply bar wires it. */
export const Interactive: StoryObj = {
  render: function Render() {
    const [state, setState] = useState<MicState>('idle');
    const levels = useLevels(state === 'listening');
    const status: MicStatusKind = state === 'listening' ? 'listening' : state === 'review' ? 'review' : 'readyPtt';
    return (
      <div style={{ width: 640, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: 10, borderRadius: 24, background: 'var(--il-color-surface-material)', border: '1px solid var(--il-color-line-strong)' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 72 }}>
            <MicStatus status={status} />
            {state === 'listening' && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}><Waveform levels={levels} /></div>}
          </div>
          {state === 'review' && <RecordAgainButton onPress={() => setState('listening')} />}
          <MicButton state={state} mode="voice" onPress={() => setState(s => (s === 'listening' ? 'review' : 'listening'))} />
        </div>
        <MicHint input="ptt" />
      </div>
    );
  }
};

/** Live levels while listening (reply bar) and dictating (email strip). Random, like the simulated provider. */
export const Waveforms: StoryObj = {
  render: function Render() {
    const levels = useLevels(true);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Waveform levels={levels} />
        <Waveform levels={levels.slice(0, 12).map(w => Math.max(4, w / 2))} size="sm" />
        <Waveform levels={Array(24).fill(4)} />
      </div>
    );
  }
};

/** The reply bar's state line for every phase. */
export const StatusLines: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {(['readyPtt', 'readyOpen', 'readyText', 'listening', 'review', 'partial', 'speaking', 'thinking', 'done', 'denied'] as MicStatusKind[]).map(s => <MicStatus key={s} status={s} speaker="Kent" />)}
    </div>
  )
};

/** The hint under the bar: push to talk (default), hands free, text, and mic blocked. Wraps when narrow. */
export const Hints: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 32 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 640 }}>
        {(['ptt', 'open', 'text', 'denied'] as MicHintInput[]).map(i => <MicHint key={i} input={i} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 340 }}>
        {(['ptt', 'open'] as MicHintInput[]).map(i => <MicHint key={i} input={i} />)}
      </div>
    </div>
  )
};
