import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MicState } from '../live/MicButton';
import { EmailStage, type EmailField, type EmailStageProps } from './EmailStage';
import { LiveBriefCard } from './LiveBriefCard';
import { LiveShell, type LiveShellProps } from './LiveShell';
import { MeetingStage, type MeetingAttendee } from './MeetingStage';
import { ReactingScreen } from './ReactingScreen';
import { RolePlayStage, type RolePlayStageProps } from './RolePlayStage';
import { SponsorStage, type SponsorStageProps } from './SponsorStage';
import type { LiveBrief, LiveConversation, LiveFormat, LiveMode, LivePerson, LiveTurn } from './types';

const meta: Meta = { title: 'Components/Live shell' };
export default meta;

/** The four formats the design draws in the shell; chat, interview and plan have their own stories (D14). */
type DesignedFormat = Exclude<LiveFormat, 'chat' | 'interview' | 'plan'>;

const noop = () => {};
const person = (id: string, name: string, pronoun: LivePerson['pronoun'] = 'he'): LivePerson => ({ id, name, img: `/assets/npc/${id}.png`, pronoun });
const KENT = person('kent', 'Kent Goldberg');
const BETH = person('beth', 'Beth Killiney', 'she');
const PRIYA: LivePerson = { id: 'sponsor', name: 'Priya Nair', img: '', pronoun: 'she' };
const TEAM = [
  KENT, BETH, person('mandy', 'Mandy Lobert', 'she'), person('peter', 'Peter Higgins'), person('green', 'Green Bell'),
  person('lowe', 'Lowe Rex'), person('ruth', 'Ruth Ether', 'she'), person('justin', 'Justin Keel'), person('jack', 'Jack Holt'), person('derick', 'Derick Kaynes')
];

const KENT_LINES = [
  "Hi. Thanks for finally making time. I wasn't sure you got my message.",
  "Since the territory split, my best leads go to Beth. I've been doing this six years and nobody asked me.",
  'Okay. That would actually help. I can bring Beth up to speed on the old accounts.'
];
const YOU_LINES = [
  "I'm sorry I missed it yesterday. I want to hear what's on your mind, take your time.",
  "That's fair, and I should have asked. Let's look at lead routing together, and I'd value your help getting Beth up to speed."
];
const LEVELS = [4, 12, 22, 30, 18, 9, 26, 34, 14, 6, 20, 28, 10, 16, 32, 24, 8, 12, 22, 18, 6, 14, 26, 10];

const npc = (i: number, text = KENT_LINES[i], extra: Partial<LiveTurn> = {}): LiveTurn => ({ id: `n${i}`, speaker: KENT, text, aiGenerated: true, ...extra });
const you = (i: number, text = YOU_LINES[i]): LiveTurn => ({ id: `y${i}`, speaker: 'you', text, aiGenerated: false });
const words = (s: string, n: number) => s.split(' ').slice(0, n).join(' ');

const BRIEFS: Record<DesignedFormat, LiveBrief> = {
  roleplay: {
    goal: 'Find out what is bothering Kent and rebuild his trust.',
    known: ['Six years on the team.', 'Lost his best leads in the territory split.', 'You missed his chat request yesterday.'],
    mood: { key: 'frustrated' }, promises: [], declaredStyle: 'D'
  },
  meeting: {
    goal: 'Decide on the Ashcroft discount with the team, and hear the quieter voices.',
    agenda: ['Ashcroft discount', 'Demo length', 'Friday review'], known: ['Ruth rarely speaks up in meetings.'], mood: { text: 'Mostly upbeat, two struggling' }
  },
  sponsor: { goal: 'Give Priya an honest view of the pipeline and a plan she can back.', known: ['Demo conversion and the Ashcroft deal.'], mood: { text: 'Steady, 3 of 5' } },
  email: { goal: 'Follow up with Kent in writing so the change sticks.', known: ['Your 1:1 went well. Kent agreed to help Beth.'], tone: 'Warm and specific. Name a time.' }
};
const TIPS: Record<DesignedFormat, string> = {
  roleplay: 'Acknowledge the missed message first. People share more once they feel heard.',
  meeting: 'Invite people by name. A raised hand left waiting costs trust.',
  sponsor: 'Lead with the number, then the plan. Priya values directness.',
  email: 'Put the agreement in writing, with a date.'
};
const META: Record<DesignedFormat, LiveShellProps['meta']> = {
  roleplay: { cost: 0.5 }, meeting: { cost: 1, topic: 'the Ashcroft discount' }, sponsor: { cost: 0, minutes: 6 }, email: { cost: 0 }
};
const NAME: Record<DesignedFormat, LivePerson | null> = { roleplay: KENT, meeting: null, sponsor: PRIYA, email: KENT };

/** The screen at 1440 by 900 as the app mounts it, or narrower for a tablet. */
const Frame = ({ width = 1440, children }: { width?: number; children: ReactNode }) => (
  <div style={{ width, minHeight: 900, display: 'flex', flexDirection: 'column' }}>{children}</div>
);

interface ShellState {
  format?: DesignedFormat;
  mode?: LiveMode;
  mic?: MicState;
  conversation?: LiveConversation;
  draft?: string;
  hintUsed?: boolean;
  briefOpen?: boolean;
  offline?: boolean;
  partial?: boolean;
  voiceInput?: 'ptt' | 'open';
  speaker?: string;
}

/** Shell props for a static frame. */
function shell(st: ShellState, children: ReactNode): LiveShellProps {
  const format = st.format ?? 'roleplay';
  const conversation = st.conversation ?? 'yourTurn';
  return {
    format, personName: NAME[format]?.name ?? '', pronoun: NAME[format]?.pronoun, meta: META[format],
    timer: { seconds: 372, paused: false }, onPause: noop, mode: st.mode ?? 'voice', onModeChange: noop,
    hint: { available: !st.hintUsed, text: st.hintUsed ? TIPS[format] : null, onRequest: noop },
    endKind: conversation === 'closed' ? 'finish' : format === 'email' ? 'discard' : 'end', onEnd: noop, offline: st.offline,
    brief: BRIEFS[format], briefOpen: st.briefOpen ?? true, onBriefToggle: noop, onInterrupt: noop,
    input: format === 'email' ? null : {
      mic: st.mic ?? 'idle', conversation, voiceInput: st.voiceInput, speakerName: st.speaker ?? 'Kent', draft: st.draft ?? '', onDraft: noop, onSend: noop,
      onMicPress: noop, onRecordAgain: noop, levels: LEVELS, partial: st.partial
    },
    children
  };
}

type RolePlay = Partial<RolePlayStageProps>;
const rolePlay = (p: RolePlay = {}) => (
  <RolePlayStage person={KENT} mood="frustrated" conversation="yourTurn" turns={[npc(0)]} onReplay={noop}
    caption={{ name: 'Kent', text: KENT_LINES[0], aiGenerated: true }} {...p} />
);
const RolePlayFrame = ({ st = {}, stage = {} }: { st?: ShellState; stage?: RolePlay }) => (
  <Frame><LiveShell {...shell(st, rolePlay({ conversation: st.conversation, ...stage }))} /></Frame>
);

const BODY = "Hi Kent,\n\nThanks for being honest with me today. You're right that we changed the territory split without asking you, and I'm sorry.\n\nCan we sit down Thursday at 10 to look at routing together? I'd also like your help getting Beth up to speed on the older accounts.\n\n";
const email = (p: Partial<EmailStageProps> = {}) => (
  <EmailStage to={[KENT]} cc={[BETH]} subject="Lead routing, and thank you" body={BODY} onSubject={noop} onBody={noop}
    onAddRecipient={noop} onDictate={noop} dictating={null} levels={LEVELS.slice(0, 12).map(w => Math.max(4, w / 2))} onSend={noop} {...p} />
);

const attendees = (n: number, hands: string[] = ['ruth']): MeetingAttendee[] => TEAM.slice(0, n).map(m => ({ ...m, speaking: m.id === 'green', raisedHand: hands.includes(m.id) }));
const meeting = (n = 10, hands?: string[]) => (
  <MeetingStage attendees={attendees(n, hands)} onCallOn={noop}
    caption={{ name: 'Green', text: 'Ashcroft is close, but procurement wants twelve percent off.', aiGenerated: true }} />
);

const FUNNEL: SponsorStageProps['funnel'] = {
  periodUnit: 'week', scale: 45,
  stages: [['Lead generation', 42, 40], ['Qualification', 28, 30], ['Solution demo', 12, 22], ['Proposal', 9, 12], ['Closing', 4, 6]].map(([name, count, ideal]) => ({ key: String(name), name: String(name), count: Number(count), ideal: Number(ideal) }))
};
const sponsor = (p: Partial<SponsorStageProps> = {}) => (
  <SponsorStage sponsor={PRIYA} speaking={false} onNoteChange={noop} funnel={FUNNEL} kpi={{ revenue: 41200, target: 240000 }}
    caption={{ name: 'Priya', text: 'Thanks for joining. Walk me through where the pipeline stands.', aiGenerated: true }}
    notes={[{ value: 'Ashcroft is winnable at list price', prompt: 'Where the pipeline stands' }, { value: '', prompt: 'What is blocking demos' }, { value: '', prompt: 'What you need from Priya' }]} {...p} />
);

// The designed frames, l1 to l6.

/** l1: 1:1 by voice, the transcript ready to edit before sending. */
export const L1VoiceReview: StoryObj = { render: () => <RolePlayFrame st={{ mic: 'review', draft: YOU_LINES[0] }} /> };

/** l1 at tablet size, 834 wide (an iPad held upright): the same layout, narrower (D69). */
export const L1Tablet: StoryObj = { render: () => <Frame width={834}><LiveShell {...shell({ mic: 'review', draft: YOU_LINES[0] }, rolePlay())} /></Frame> };

/** l2: Kent is speaking; the caption and the last turn stream in. Speaking interrupts. */
export const L2NpcStreaming: StoryObj = {
  render: () => (
    <RolePlayFrame st={{ conversation: 'npcSpeaking' }}
      stage={{ mood: 'guarded', turns: [npc(0), you(0), npc(1, words(KENT_LINES[1], 9), { streaming: true })], caption: { name: 'Kent', text: words(KENT_LINES[1], 9), streaming: true, aiGenerated: true } }} />
  )
};

/** l3: the same 1:1 in text mode. */
export const L3TextMode: StoryObj = { render: () => <RolePlayFrame st={{ mode: 'text' }} /> };

/** l4: email composer with recipient chips and dictation per field. */
export const L4Email: StoryObj = { render: () => <Frame><LiveShell {...shell({ format: 'email' }, email())} /></Frame> };

/** l5: team meeting with the active speaker, a raised hand and the caption. */
export const L5Meeting: StoryObj = { render: () => <Frame><LiveShell {...shell({ format: 'meeting', conversation: 'npcSpeaking', speaker: 'Green' }, meeting())} /></Frame> };

/** l6: sponsor briefing, three points first, funnel and revenue pinned. */
export const L6Sponsor: StoryObj = { render: () => <Frame><LiveShell {...shell({ format: 'sponsor', conversation: 'npcSpeaking', speaker: 'Priya' }, sponsor({ speaking: true }))} /></Frame> };

/** r1: "The team is reacting" while the evaluation runs. */
export const R1Reacting: StoryObj = { render: () => <Frame><ReactingScreen people={[KENT, BETH, TEAM[8]]} /></Frame> };

/** The evaluation is slow: keep waiting or retry. */
export const ReactingSlow: StoryObj = { render: () => <Frame><ReactingScreen people={[KENT, BETH, TEAM[8]]} slow onKeepWaiting={noop} onRetry={noop} /></Frame> };

// Edge states (the /states frames) and the engine states the design implies.

/** Listening: live transcript and waveform, the bar ringed. */
export const Listening: StoryObj = { render: () => <RolePlayFrame st={{ mic: 'listening', draft: words(YOU_LINES[0], 9) }} /> };

/** Waiting for the AI reply. */
export const Thinking: StoryObj = { render: () => <RolePlayFrame st={{ conversation: 'npcThinking' }} stage={{ caption: null, turns: [npc(0), you(0)] }} /> };

/** The AI reply is slow: notice and Retry. */
export const SlowReply: StoryObj = { render: () => <RolePlayFrame st={{ conversation: 'npcThinking' }} stage={{ caption: null, slow: true, onRetry: noop, turns: [npc(0), you(0)] }} /> };

/** The conversation reached a natural close: End becomes the primary action. */
export const NaturalClose: StoryObj = {
  render: () => <RolePlayFrame st={{ conversation: 'closed' }} stage={{ mood: 'open', turns: [npc(0), you(0), npc(1), you(1), npc(2)], caption: { name: 'Kent', text: KENT_LINES[2], aiGenerated: true } }} />
};

/** Hint requested: the one coaching tip shows in the brief and the button reads "Hint used". */
export const HintRequested: StoryObj = { render: () => <RolePlayFrame st={{ hintUsed: true }} /> };

/** The brief collapsed to "Show brief"; the stage takes the room. */
export const BriefCollapsed: StoryObj = { render: () => <RolePlayFrame st={{ briefOpen: false }} /> };

/** Mic blocked on desktop: the banner keeps the conversation going in text. */
export const MicDenied: StoryObj = { render: () => <RolePlayFrame st={{ mode: 'text', mic: 'denied' }} /> };

/** Poor audio: a partial transcript to fix before sending. */
export const PoorAudio: StoryObj = { render: () => <RolePlayFrame st={{ mic: 'review', partial: true, draft: "I'm sorry I ... it yesterday. I want to hear what's ... mind" }} /> };

/** Connection lost: the banner under the header; the draft is kept. */
export const Offline: StoryObj = { render: () => <RolePlayFrame st={{ offline: true, mode: 'text', draft: 'I want to hear what is on your mind' }} /> };

/** Text only: typing, Enter sends, the mic stays small for switching back. */
export const TextOnly: StoryObj = { render: () => <RolePlayFrame st={{ mode: 'text', draft: 'I hear you. Let us look at lead routing together.' }} stage={{ caption: null, turns: [npc(0), you(0), npc(1)] }} /> };

/** Hands free voice input instead of push to talk. */
export const HandsFree: StoryObj = { render: () => <RolePlayFrame st={{ voiceInput: 'open' }} /> };

/** An NPC turn the participant cut off. */
export const InterruptedTurn: StoryObj = {
  render: () => <RolePlayFrame st={{ mic: 'listening', draft: 'Sorry to cut in, I hear you' }} stage={{ turns: [npc(0), you(0), npc(1, words(KENT_LINES[1], 7), { interrupted: true })], caption: { name: 'Kent', text: words(KENT_LINES[1], 7), aiGenerated: true } }} />
};

/** A long conversation: the transcript scrolls and follows the newest turn. */
export const LongTranscript: StoryObj = {
  render: () => {
    const turns = Array.from({ length: 24 }, (_, i) => (i % 2 ? you(i, YOU_LINES[(i >> 1) % 2]) : npc(i, KENT_LINES[(i >> 1) % 3])));
    return <RolePlayFrame st={{ mode: 'text' }} stage={{ turns, caption: null }} />;
  }
};

/** Dictating into the email body. */
export const EmailDictating: StoryObj = { render: () => <Frame><LiveShell {...shell({ format: 'email' }, email({ dictating: 'body' }))} /></Frame> };

/** Dictating the subject; an email with initials for a recipient without a portrait. */
export const EmailSubjectAndInitials: StoryObj = {
  render: () => <Frame><LiveShell {...shell({ format: 'email' }, email({ dictating: 'subject', cc: [BETH, { id: 'x', name: 'Morgan Ade', img: '' }] }))} /></Frame>
};

/** The meeting with all 10 attendees, two hands raised. */
export const MeetingTenAttendees: StoryObj = { render: () => <Frame><LiveShell {...shell({ format: 'meeting', conversation: 'npcSpeaking', speaker: 'Green' }, meeting(10, ['ruth', 'mandy']))} /></Frame> };

// Playable: a scripted engine stand in that streams the NPC token by token.

function usePlayable() {
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [conversation, setConversation] = useState<LiveConversation>('npcSpeaking');
  const [mic, setMic] = useState<MicState>('idle');
  const [mode, setMode] = useState<LiveMode>('voice');
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState(false);
  const [briefOpen, setBriefOpen] = useState(true);
  const [paused, setPaused] = useState(false);
  const [secs, setSecs] = useState(372);
  const [mood, setMood] = useState(0);
  const step = useRef(0);
  const stream = useRef<ReturnType<typeof setInterval>>(undefined);

  const speak = (i: number) => {
    const all = KENT_LINES[i].split(' ');
    const id = `n${i}`;
    let n = 0;
    setConversation('npcSpeaking');
    setTurns(ts => [...ts, { id, speaker: KENT, text: '', streaming: true, aiGenerated: true }]);
    clearInterval(stream.current);
    stream.current = setInterval(() => {
      n++;
      setTurns(ts => ts.map(t => (t.id === id ? { ...t, text: all.slice(0, n).join(' '), streaming: n < all.length } : t)));
      if (n >= all.length) {
        clearInterval(stream.current);
        setConversation(i >= KENT_LINES.length - 1 ? 'closed' : 'yourTurn');
      }
    }, 110);
  };
  const interrupt = () => {
    clearInterval(stream.current);
    setTurns(ts => ts.map((t, i) => (i === ts.length - 1 && t.streaming ? { ...t, streaming: false, interrupted: true } : t)));
    setConversation('yourTurn');
  };
  const send = () => {
    const text = draft.trim() || YOU_LINES[Math.min(step.current, YOU_LINES.length - 1)];
    setTurns(ts => [...ts, { id: `y${step.current}`, speaker: 'you', text, aiGenerated: false }]);
    setDraft('');
    setMic('idle');
    setConversation('npcThinking');
    step.current++;
    setTimeout(() => { setMood(m => Math.min(2, m + 1)); speak(Math.min(step.current, KENT_LINES.length - 1)); }, 1200);
  };
  useEffect(() => {
    speak(0);
    return () => clearInterval(stream.current);
    // Start the first line once.
  }, []);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setSecs(x => Math.max(0, x - 1)), 1000);
    return () => clearInterval(id);
  }, [paused]);

  const last = [...turns].reverse().find(t => t.speaker !== 'you');
  const props: LiveShellProps = {
    format: 'roleplay', personName: KENT.name, pronoun: 'he', meta: META.roleplay,
    timer: { seconds: secs, paused }, onPause: () => setPaused(x => !x), mode, onModeChange: m => { setMode(m); if (mic === 'listening') setMic('review'); },
    hint: { available: !hint, text: hint ? TIPS.roleplay : null, onRequest: () => { setHint(true); setBriefOpen(true); } },
    endKind: conversation === 'closed' ? 'finish' : 'end', onEnd: noop,
    brief: BRIEFS.roleplay, briefOpen, onBriefToggle: () => setBriefOpen(x => !x), onInterrupt: interrupt,
    input: {
      mic, conversation, speakerName: 'Kent', draft, onDraft: setDraft, onSend: send, levels: LEVELS,
      onMicPress: () => {
        if (mic === 'listening') return setMic('review');
        setMic('listening');
        setDraft(YOU_LINES[Math.min(step.current, YOU_LINES.length - 1)]);
      },
      onRecordAgain: () => { setDraft(''); setMic('listening'); }
    },
    children: (
      <RolePlayStage person={KENT} mood={(['frustrated', 'guarded', 'open'] as const)[mood]} conversation={conversation} turns={turns} onReplay={noop}
        caption={conversation !== 'npcThinking' && last ? { name: 'Kent', text: last.text, streaming: last.streaming, aiGenerated: true } : null} />
    )
  };
  return props;
}

/** Everything works: Kent streams token by token, press the mic or Escape to interrupt, review and send, ask for the hint, collapse the brief, switch to text, pause. */
export const Playable: StoryObj = { render: function Render() { return <Frame><LiveShell {...usePlayable()} /></Frame>; } };

/** The email composer, playable: type, dictate per field, add from team. */
export const PlayableEmail: StoryObj = {
  render: function Render() {
    const [subject, setSubject] = useState('Lead routing, and thank you');
    const [body, setBody] = useState(BODY);
    const [dictating, setDictating] = useState<EmailField | null>(null);
    const [cc, setCc] = useState<LivePerson[]>([BETH]);
    return (
      <Frame>
        <LiveShell {...shell({ format: 'email' }, email({
          subject, body, dictating, cc, onSubject: setSubject, onBody: setBody,
          onDictate: f => setDictating(d => (d === f ? null : f)), onAddRecipient: f => { if (f === 'cc') setCc(c => (c.length < TEAM.length ? [...c, TEAM[c.length + 1]] : c)); }
        }))} />
      </Frame>
    );
  }
};

/** The meeting, playable: call on whoever raised a hand. */
export const PlayableMeeting: StoryObj = {
  render: function Render() {
    const [hands, setHands] = useState(['ruth', 'mandy']);
    const [called, setCalled] = useState<string | null>(null);
    const list = TEAM.map(m => ({ ...m, speaking: m.id === (called ?? 'green'), raisedHand: hands.includes(m.id) }));
    const speaker = list.find(a => a.speaking)!;
    return (
      <Frame>
        <LiveShell {...shell({ format: 'meeting', conversation: 'npcSpeaking', speaker: speaker.name.split(' ')[0] },
          <MeetingStage attendees={list} onCallOn={id => { setCalled(id); setHands(h => h.filter(x => x !== id)); }}
            caption={{ name: speaker.name.split(' ')[0], text: called ? 'Thanks. If we hold price, I can rework the proposal to show the payback period.' : 'Ashcroft is close, but procurement wants twelve percent off.', aiGenerated: true }} />)} />
      </Frame>
    );
  }
};

/** The sponsor briefing, playable: write your three points. */
export const PlayableSponsor: StoryObj = {
  render: function Render() {
    const [notes, setNotes] = useState(['Ashcroft is winnable at list price', '', '']);
    const prompts = ['Where the pipeline stands', 'What is blocking demos', 'What you need from Priya'];
    return (
      <Frame>
        <LiveShell {...shell({ format: 'sponsor', speaker: 'Priya' }, sponsor({
          notes: [0, 1, 2].map(i => ({ value: notes[i], prompt: prompts[i] })) as SponsorStageProps['notes'],
          onNoteChange: (i, v) => setNotes(n => n.map((x, j) => (j === i ? v : x)))
        }))} />
      </Frame>
    );
  }
};

// The portrait tablet layout (D73), 834 wide: one column, the 1:1 goal beside the portrait, 56px composer.
const TabletFrame = ({ children }: { children: ReactNode }) => (
  <div data-tablet="" style={{ width: 834, minHeight: 1194, display: 'flex', flexDirection: 'column' }}>{children}</div>
);
const tabletBrief = (format: DesignedFormat, open = false) => (
  <LiveBriefCard layout="tablet" bare format={format} brief={BRIEFS[format]} pronoun="he" tip={null} open={open} onToggle={noop} />
);

/** 1:1 by voice at 834 (the approved Tablet frame): the goal beside the portrait, the log, the voice composer. */
export const TabletPortrait1on1: StoryObj = {
  render: () => (
    <TabletFrame>
      <LiveShell {...shell({ mic: 'listening', draft: words(YOU_LINES[0], 9) }, rolePlay({ layout: 'tablet', aside: tabletBrief('roleplay'), turns: [npc(0), you(0), npc(1)] }))} layout="tablet" briefInStage />
    </TabletFrame>
  )
};
/** The 1:1 at 834 with the whole brief open under the goal. */
export const TabletPortraitBriefOpen: StoryObj = {
  render: () => <TabletFrame><LiveShell {...shell({ mode: 'text' }, rolePlay({ layout: 'tablet', aside: tabletBrief('roleplay', true) }))} layout="tablet" briefInStage /></TabletFrame>
};
/** The team meeting at 834: the same shell, the brief's goal above the stage. */
export const TabletPortraitMeeting: StoryObj = {
  render: () => <TabletFrame><LiveShell {...shell({ format: 'meeting', conversation: 'npcSpeaking', speaker: 'Green', briefOpen: false }, meeting())} layout="tablet" /></TabletFrame>
};
/** The email at 834. */
export const TabletPortraitEmail: StoryObj = { render: () => <TabletFrame><LiveShell {...shell({ format: 'email', briefOpen: false }, email())} layout="tablet" /></TabletFrame> };
/** The sponsor briefing at 834. */
export const TabletPortraitSponsor: StoryObj = {
  render: () => <TabletFrame><LiveShell {...shell({ format: 'sponsor', conversation: 'npcSpeaking', speaker: 'Priya', briefOpen: false }, sponsor({ speaking: true }))} layout="tablet" /></TabletFrame>
};
