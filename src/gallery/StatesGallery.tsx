import { css } from '../lib/css';
import { F, FrameCanvas, type FrameGroup } from './Frames';

/** Edge states: loading, empty, limits, connection, AI and voice failures. Port of `iLead States.dc.html`. */
const GROUPS: Array<[string, ReturnType<typeof F>[]]> = [
  ['Loading and empty', [F('z1', 'Loading the office', { screen: 'board', uiState: 'loading' }), F('z2', 'Inbox empty', { screen: 'board', uiState: 'empty' })]],
  ['Board limits and connection', [
    F('z3', 'Out of days: actions lock, End week is the only primary button. Days left pulses at 1', { screen: 'board', capacity: 0 }),
    F('z4', 'Offline: clock paused, actions queue and retry', { screen: 'board', uiState: 'offline' })]],
  ['AI thinking, streaming, slow and error', [
    F('z5', 'Listening, live transcript and waveform', { screen: 'live', variant: 'roleplay', uiState: 'listening' }),
    F('z6', 'NPC thinking', { screen: 'live', variant: 'roleplay', uiState: 'thinking' }),
    F('z7', 'NPC slow to reply, retry after 8 seconds', { screen: 'live', variant: 'roleplay', uiState: 'slow' }),
    F('z8', 'Conversation reached a natural close', { screen: 'live', variant: 'roleplay', uiState: 'done' }),
    F('z9', 'Evaluation taking longer than usual', { screen: 'reacting', uiState: 'slow' }),
    F('z10', 'Hint used: one coaching tip per interaction', { screen: 'live', variant: 'roleplay', uiState: 'hint' })]],
  ['Voice failures', [
    F('z11', 'Mic denied in the conversation. Banner and text fallback', { screen: 'live', variant: 'roleplay', uiState: 'micDenied' }),
    F('z12', 'Poor audio, partial transcript to fix', { screen: 'live', variant: 'roleplay', uiState: 'poorAudio' }),
    F('z13', 'Mic denied during voice setup', { screen: 'onboarding', step: 'voice', uiState: 'micDenied' }),
    F('z14', 'Dictating into an email', { screen: 'live', variant: 'email', uiState: 'dictating' }),
    F('z15', 'Offline during a conversation', { screen: 'live', variant: 'roleplay', uiState: 'offline' })]]
];

const groups: FrameGroup[] = GROUPS.map(([title, frames], i) => ({ id: 'sg' + i, title, frames }));

export function StatesGallery() {
  return (
    <FrameCanvas
      groups={groups}
      flat
      intro={
        <section className="dv-turn" id="intro" style={{ paddingBottom: 8 }}>
          <h1 style={css('margin:0; font-size:32px; font-weight:700; letter-spacing:-0.03em; color:#1a1a1a')}>iLead · System states</h1>
          <p style={css('margin:8px 0 0; font-size:14px; color:rgba(0,0,0,.6)')}>
            Loading, empty, error, AI thinking and streaming, offline and mic denied. Main screens are in <a href="/screens">iLead Screens</a>.
          </p>
        </section>
      }
    />
  );
}
