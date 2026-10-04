import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { OnboardingFlow, type OnboardingFlowProps } from './OnboardingFlow';
import { LanguageStep, SponsorStep, VoiceStep } from './OnboardingSteps';
import { TeamStep } from './TeamStep';
import type { OnboardingMember } from './types';

const noop = () => {};

const Frame = ({ children }: { children: ReactNode }) => <div style={{ width: 1440, minHeight: 900, display: 'flex', flexDirection: 'column' }}>{children}</div>;

const member = (id: string, name: string, title: string, stage: string, stats: [number, number, number, number], read = false): OnboardingMember => ({
  id, name, title, stage, img: `/assets/npc/${id}.png`, read,
  stats: { skill: stats[0], morale: stats[1], result: stats[2], trust: stats[3] },
  facts: { previous: 'Brightline Media', tenure: '6 years', experience: '9 years in sales', skills: 'Cold calling, territory knowledge', remarks: 'Top prospector two years running. CRM updates lag.' }
});

const TEAM: OnboardingMember[] = [
  member('kent', 'Kent Goldberg', 'Lead Generation Executive', 'Leads', [30, 22, 49, 50]),
  member('beth', 'Beth Killiney', 'Lead Generation Executive', 'Leads', [25, 73, 45, 50]),
  member('justin', 'Justin Keel', 'Qualification Executive', 'Qualify', [22, 40, 52, 50]),
  member('derick', 'Derick Kaynes', 'Qualification Executive', 'Qualify', [70, 71, 62, 50]),
  member('green', 'Green Bell', 'Proposal Executive', 'Proposal', [89, 56, 69, 50]),
  member('lowe', 'Lowe Rex', 'Proposal Executive', 'Proposal', [80, 45, 67, 50]),
  member('jack', 'Jack Holt', 'Negotiation Executive', 'Negotiation', [92, 85, 95, 50]),
  member('peter', 'Peter Higgins', 'Negotiation Executive', 'Negotiation', [10, 15, 16, 50]),
  member('ruth', 'Ruth Ether', 'Conversion Executive', 'Conversion', [80, 50, 65, 50]),
  member('mandy', 'Mandy Lobert', 'Conversion Executive', 'Conversion', [60, 80, 71, 50])
];

/** The playable app's Sales Elevator storyline: a letter, no video, one language. */
const ENGINE: OnboardingFlowProps = {
  teamSize: 10, periods: { unit: 'week', count: 8 }, subPeriodUnit: 'day', capacity: 5,
  languages: [],
  sponsor: {
    name: 'Paula Jacob', role: 'Regional Sales Director, Innov8 Elevators', initials: 'PJ', img: null, video: null,
    letter: {
      welcome: ['Welcome to Innov8 Elevators. I am glad you are here.', 'You are taking over a team of ten across our sales funnel, from first call to signed deal. Some are thriving, some are new, and one or two are struggling.', 'I care about two things: the number, and whether the team is stronger when you leave than when you arrived.'],
      product: ['Deals move through five stages: Leads, Qualify, Proposal, Negotiation, and Conversion. Each stage hands its deals to the next, so one weak stage slows everything after it.', 'Every stage needs someone in it, and at most two people can work a stage at once.'],
      targets: ['Reach $240,000 in revenue over eight weeks.', 'Keep Team Morale and Trust healthy. A burned out team will not hold the number next quarter.', 'You have five days of your own time each week. Spend them well.']
    }
  },
  organisation: 'Innov8 Elevators', sampleName: 'Kent', members: TEAM,
  onConsent: noop, onSay: noop, onFinish: noop, onOpenProfile: noop
};

const meta: Meta<typeof OnboardingFlow> = {
  title: 'Components/Onboarding', component: OnboardingFlow, args: ENGINE,
  decorators: [S => <Frame><S /></Frame>]
};
export default meta;
type Story = StoryObj<typeof OnboardingFlow>;

/** Step 1 with one language configured: no picker. */
export const Welcome: Story = {};
/** Step 2: the sponsor's letter, Next locked for a few seconds. No video, so initials on the brand fill. */
export const Sponsor: Story = { args: { initial: { step: 'sponsor' } } };
/** Step 2 with a welcome video: the caption bar and play button. */
export const SponsorWithVideo: Story = { args: { initial: { step: 'sponsor' }, sponsor: { ...ENGINE.sponsor, video: { caption: 'Welcome to Innov8 Elevators. I am glad you are here.' } } } };
/** Step 2 with a portrait from the storyline. */
export const SponsorWithPortrait: Story = { args: { initial: { step: 'sponsor' }, sponsor: { ...ENGINE.sponsor, img: '/assets/npc/ruth.png' } } };
export const Consent: Story = { args: { initial: { step: 'consent' } } };
/** Consent with no organisation configured. */
export const ConsentNoOrganisation: Story = { args: { initial: { step: 'consent' }, organisation: null } };
export const Voice: Story = { args: { initial: { step: 'voice' } } };
export const VoiceHeard: Story = { args: { initial: { step: 'voice', voice: 'heard' } } };
export const VoiceDenied: Story = { args: { initial: { step: 'voice', voice: 'denied' } } };
export const HowToPlay: Story = { args: { initial: { step: 'how' } } };
/** A monthly storyline: "Each month ... spend your 4 weeks". */
export const HowToPlayMonthly: Story = { args: { initial: { step: 'how' }, periods: { unit: 'month', count: 6 }, subPeriodUnit: 'week', capacity: 4 } };
/** Step 6 before any profile is read: stats hidden, Start locked. */
export const Team: Story = { args: { initial: { step: 'team' } } };
/** Three profiles read: stats show, Start unlocks. */
export const TeamRead: Story = { args: { initial: { step: 'team', open: 'kent', read: ['kent', 'green', 'ruth'] } } };
/** A profile opened while the engine has not sent its stats yet. */
export const TeamStatsPending: Story = {
  render: () => <TeamStep members={TEAM.map(m => (m.id === 'kent' ? { ...m, stats: null } : m))} read={['kent']} open="kent" readsNeeded={3} startLabel="Start week 1" onOpen={noop} onStart={noop} />
};
/** Long names and titles wrap inside the cards. */
export const TeamLongText: Story = {
  render: () => (
    <TeamStep members={TEAM.map((m, i) => (i === 0 ? { ...m, name: 'Kent Alexander Goldberg Montgomery', title: 'Senior Lead Generation and Partnerships Executive', stage: 'Lead generation and nurturing' } : m))}
      read={['kent']} open="kent" readsNeeded={3} startLabel="Start week 1" onOpen={noop} onStart={noop} />
  )
};
/** Three languages, as the design shows. */
export const LanguagePicker: Story = {
  render: () => (
    <LanguageStep title="Lead a sales team of ten, for eight weeks." lang={1} onLang={noop} onBegin={noop}
      languages={[{ id: 'en', name: 'English', note: 'Voice and captions' }, { id: 'es', name: 'Español', note: 'Voz y subtítulos' }, { id: 'id', name: 'Bahasa Indonesia', note: 'Suara dan teks' }]} />
  )
};
/** Next open on the last tab. */
export const SponsorTargets: Story = { render: () => <SponsorStep sponsor={ENGINE.sponsor} tab="targets" onTab={noop} wait={0} onPlay={noop} onNext={noop} /> };
/** Mid test: listening, with part of the phrase heard. */
export const VoiceListening: Story = {
  render: () => (
    <VoiceStep check="idle" listening wave={[6, 12, 30, 22, 8, 16, 34, 28, 10, 6, 18, 26, 32, 14, 8, 20, 24, 12, 6, 30, 22, 10, 16, 28, 8, 6, 12, 20]}
      words={["I'm", 'ready', 'to', 'lead', 'my', 'team.']} heard={3} sampleName="Kent" onMic={noop} onSample={noop} onNext={noop} onSkip={noop} />
  )
};
