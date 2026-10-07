import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ReactNode } from 'react';
import { LoadingScreen } from '../shell/LoadingScreen';
import { ExitDialog, PauseDialog, ResumeDialog, SessionExpiredDialog } from './SessionDialogs';
import { ResumeRecap, type ResumeRecapProps } from './ResumeRecap';
import { SettingsDialog, type SettingsValues } from './SettingsDialog';

const noop = () => {};

/** Dialogs cover the app root they are rendered in; this stands in for it. */
const AppArea = ({ children, height = 900 }: { children: ReactNode; height?: number }) => (
  <div style={{ position: 'relative', width: 1440, height, display: 'flex', flexDirection: 'column' }}>{children}</div>
);

const meta: Meta<typeof SettingsDialog> = { title: 'Components/Settings', component: SettingsDialog, decorators: [S => <AppArea><S /></AppArea>] };
export default meta;
type Story = StoryObj<typeof SettingsDialog>;

const VALUES: SettingsValues = { text: 100, captions: true, reduced: false, input: 'ptt', clock: true, voiceConsent: null };

function LiveSettings({ initial, voiceConsent }: { initial: SettingsValues; voiceConsent?: boolean }) {
  const [values, setValues] = useState(initial);
  return <SettingsDialog values={values} onChange={p => setValues(v => ({ ...v, ...p }))} onClose={noop} voiceConsent={voiceConsent} />;
}

/** Frame x1. */
export const Settings: Story = { args: { values: VALUES, onChange: noop, onClose: noop, frozen: true } };
/** The playable app adds the voice consent switch. Interactive. */
export const WithVoiceConsent: Story = { render: () => <LiveSettings initial={VALUES} voiceConsent /> };
/** Text at 200%, voice declined, every switch off. */
export const LargeTextOff: Story = { render: () => <LiveSettings initial={{ text: 200, captions: false, reduced: true, input: 'text', clock: false, voiceConsent: false }} voiceConsent /> };
/** A short window: the dialog scrolls inside. */
export const ShortWindow: Story = { decorators: [S => <AppArea height={420}><S /></AppArea>], render: () => <LiveSettings initial={VALUES} voiceConsent /> };
/** Frame x2. */
export const Paused: Story = { render: () => <PauseDialog onResume={noop} /> };
/** Frame x3. */
export const Resume: Story = {
  render: () => (
    <ResumeDialog period={2} periodUnit="week" sub={3} subPeriodUnit="day" onBack={noop} waiting={['Kent', 'Priya']}
      recent={[
        { img: '/assets/npc/beth.png', title: '1:1 with Beth went well', metric: 'morale', delta: 6 },
        { img: '/assets/npc/lowe.png', title: 'Feedback to Lowe felt public', metric: 'trust', delta: -3 },
        { img: '/assets/npc/green.png', title: 'Ashcroft moved to proposal', metric: 'result', delta: 4 }
      ]} />
  )
};
/** A monthly storyline, one outcome, nobody waiting. */
export const ResumeMonthly: Story = {
  render: () => <ResumeDialog period={3} periodUnit="month" sub={2} subPeriodUnit="week" onBack={noop} waiting={[]} recent={[{ img: '/assets/npc/kent.png', title: 'Coaching with Kent landed', metric: 'skill', delta: 5 }]} />
};
const RECAP: Omit<ResumeRecapProps, 'onBack'> = {
  period: 3, periodUnit: 'week', sub: 2, subPeriodUnit: 'day', left: '3½ days left',
  headline: '1:1 with Kent went well',
  inbox: [
    { id: 'm1', from: 'Paula, sponsor note', title: 'Where are we on conversions?', urgent: true, due: 'Due today' },
    { id: 'm2', from: 'Chat from Beth', title: 'Can we talk about the Ashcroft lead?', urgent: false, due: 'Due in 2 days' },
    { id: 'm3', from: 'News', title: 'A competitor cut prices', urgent: false, due: null }
  ],
  promises: [{ id: 'p1', name: 'Kent', text: 'Career talk', due: 'Due in 1 day' }], since: 'this',
  changes: [
    { metric: 'skill', start: 56, now: 57, trend: 'up' }, { metric: 'morale', start: 54, now: 52, trend: 'down' },
    { metric: 'result', start: 58, now: 58, trend: 'flat' }, { metric: 'trust', start: 53, now: 57, trend: 'up' }
  ]
};
/** Welcome back in the playable app, built from the engine view: last outcome, inbox (urgent first), promises, KPIs since the week began. */
export const ResumeOnEngine: Story = { render: () => <ResumeRecap {...RECAP} onBack={noop} /> };
/** Early in a run: no outcome yet, nothing waiting, no promises. */
export const ResumeOnEngineQuiet: Story = { render: () => <ResumeRecap {...RECAP} headline={null} inbox={[]} promises={[]} onBack={noop} /> };
/** Frame x4: only signing in closes it. */
export const SessionExpired: Story = { render: () => <SessionExpiredDialog onSignIn={noop} /> };
/** Frame z1. */
export const Loading: Story = { render: () => <LoadingScreen /> };

/** Exit from the game menu (D89), when the launch gave a return address: the run is saved; Stay or Exit. */
export const Exit: Story = { render: () => <ExitDialog onStay={noop} onExit={noop} /> };
