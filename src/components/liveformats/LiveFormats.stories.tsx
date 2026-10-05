import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ReactNode } from 'react';
import { ChatStage, type ChatComposer, type ChatStageProps } from './ChatStage';
import { CompareView, type CompareDecision } from './CompareView';
import { InterviewStage, type Candidate } from './InterviewStage';
import { PlanForm, type PlanField, type PlanFields, type PlanFormProps, type PlanTextField } from './PlanForm';
import type { StageNpc, StageTurn } from './shared';

const meta: Meta = { title: 'Components/Live formats', parameters: { layout: 'fullscreen' } };
export default meta;

const noop = () => {};

/**
 * The centre stage as the live shell leaves it: beside the 300 wide brief at 1440 (1072 by 680).
 * In an 834 wide app (a tablet held upright) it is about 466 wide. The stage fills this box.
 */
const Stage = ({ width = 1072, height = 680, children }: { width?: number; height?: number; children: ReactNode }) => (
  <div style={{ width: '100%', maxWidth: width, height, display: 'flex', flexDirection: 'column' }}>{children}</div>
);

function useLevels(on: boolean) {
  const [levels, setLevels] = useState([4, 12, 22, 30, 18, 9, 26, 34, 14, 6, 20, 28]);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setLevels(l => l.map(() => 4 + Math.round(Math.random() * 30))), 100);
    return () => clearInterval(id);
  }, [on]);
  return levels;
}

/* Chat */

const KENT: StageNpc = { id: 'kent', name: 'Kent Goldberg', firstName: 'Kent', img: '/assets/npc/kent.png', mood: 'frustrated' };
const W2D2 = { period: 2, sub: 2 };
const W2D3 = { period: 2, sub: 3 };

const OPENING: StageTurn[] = [
  { id: 'c1', speaker: 'npc', text: 'Hi. Do you have 15 minutes today?', at: W2D2 },
  { id: 'c2', speaker: 'npc', text: 'Something has been bothering me since the territory split.', at: W2D2 }
];
const THREAD: StageTurn[] = [
  ...OPENING,
  { id: 'c3', speaker: 'you', text: 'Sorry, I only just saw this. I have time now. What is on your mind?', at: W2D3 },
  { id: 'c4', speaker: 'npc', text: 'My best leads went to Beth and nobody asked me. Six years on this team.', at: W2D3 }
];
const VOICE: StageTurn[] = [
  ...THREAD,
  { id: 'c5', speaker: 'you', text: 'That is fair, and I should have asked you first. Can we look at lead routing together on Thursday at 10?', voiceNote: true, at: W2D3 },
  { id: 'c6', speaker: 'npc', text: 'Thursday works. I can also help Beth with the older accounts, if that is useful.', voiceNote: true, at: W2D3 }
];

function useComposer(initial = ''): ChatComposer {
  const [draft, setDraft] = useState(initial);
  return { draft, onDraft: setDraft, onSend: () => setDraft(''), onRecord: noop };
}

const chat = (p: Partial<ChatStageProps>, width?: number) => function Render() {
  const composer = useComposer();
  return <Stage width={width}><ChatStage npc={KENT} turns={OPENING} ended={null} periodUnit="week" subPeriodUnit="day" composer={composer} onClose={noop} onPlay={noop} {...p} /></Stage>;
};

/** The NPC writes first: Kent's two opening messages under the Week 2, Day 2 divider, and an empty composer. */
export const ChatNpcOpens: StoryObj = { render: chat({}) };
/** Kent is composing: the typing line under the thread. His turn has no words yet, so no bubble. */
export const ChatStreaming: StoryObj = { render: chat({ turns: [...THREAD.slice(0, 3), { id: 'c4', speaker: 'npc', text: '', streaming: true, at: W2D3 }] }) };
/** Voice notes from both sides: the transcript with a small play control. Kent's note is playing. */
export const ChatVoiceNote: StoryObj = { render: chat({ turns: VOICE, playingId: 'c6' }) };
/** Recording a voice note: the transcript fills the draft and stays editable before it is sent. */
export const ChatRecording: StoryObj = {
  render: function Render() {
    const levels = useLevels(true);
    const [draft, setDraft] = useState('Can we look at lead routing together on Thursday');
    return <Stage><ChatStage npc={KENT} turns={THREAD} ended={null} periodUnit="week" subPeriodUnit="day" onClose={noop} composer={{ draft, onDraft: setDraft, onSend: noop, onRecord: noop, recording: true, levels }} /></Stage>;
  }
};
/** Kent signed off: the quiet line closes the thread, and the composer and Close chat are gone. */
export const ChatSignedOff: StoryObj = { render: chat({ turns: VOICE, ended: 'npc' }) };
/** You closed the chat. */
export const ChatClosedByYou: StoryObj = { render: chat({ turns: THREAD, ended: 'you' }) };
/** A long thread over three days scrolls inside the stage and stays pinned to the newest message. */
export const ChatLongThread: StoryObj = {
  render: chat({
    turns: [
      ...VOICE,
      ...Array.from({ length: 10 }, (_, i): StageTurn => ({ id: `l${i}`, speaker: i % 2 ? 'you' : 'npc', text: i % 2 ? 'Thanks for flagging it. I will put the routing change in writing today, and copy Beth so it is clear.' : 'One more thing. The CRM still shows me behind on the accounts I handed over, which is not true. Could someone fix the ownership field?', at: { period: 2, sub: 4 } })),
      { id: 'l99', speaker: 'npc', text: 'Thanks. See you Thursday.', at: { period: 2, sub: 5 } }
    ]
  })
};
/** Tablet size: the stage of an 834 wide app, beside the brief. */
export const ChatTablet: StoryObj = { render: chat({ turns: VOICE.slice(0, 5) }, 466) };

/** Send a message: Kent types, replies, then signs off after the third reply. */
export const ChatInteractive: StoryObj = {
  render: function Render() {
    const [turns, setTurns] = useState<StageTurn[]>(OPENING);
    const [draft, setDraft] = useState('');
    const [ended, setEnded] = useState<'you' | 'npc' | null>(null);
    const busy = turns.some(x => x.streaming);
    const send = () => {
      const n = turns.length;
      setTurns(x => [...x, { id: `y${n}`, speaker: 'you', text: draft, at: W2D3 }, { id: `n${n}`, speaker: 'npc', text: '', streaming: true, at: W2D3 }]);
      setDraft('');
      setTimeout(() => {
        setTurns(x => x.map(tu => (tu.id === `n${n}` ? { ...tu, text: 'Okay. That would actually help.', streaming: false } : tu)));
        if (n >= 6) setEnded('npc');
      }, 1400);
    };
    return <Stage><ChatStage npc={KENT} turns={turns} ended={ended} periodUnit="week" subPeriodUnit="day" onClose={() => setEnded('you')} composer={{ draft, onDraft: setDraft, onSend: send, busy }} /></Stage>;
  }
};

/* Interview */

const ANA: Candidate = {
  id: 'mandy', name: 'Mandy Okafor', firstName: 'Mandy', title: 'Account Executive candidate', img: '/assets/npc/mandy.png',
  cv: { previous: 'Brightline Logistics', experience: '6 years in B2B sales, 2 leading a small team', skills: ['Discovery calls', 'Negotiation', 'Forecasting'], remarks: 'Referred by Green. Moved to a new city this year.' }
};
const PETER: Candidate = {
  id: 'peter', name: 'Peter Lindqvist', firstName: 'Peter', title: 'Account Executive candidate', img: '/assets/npc/peter.png',
  cv: { previous: 'Halden Group', experience: '4 years in field sales', skills: ['Demos', 'Pipeline hygiene', 'CRM admin', 'Onboarding new reps'], remarks: null }
};
const INTERVIEW: StageTurn[] = [
  { id: 'i1', speaker: 'you', text: 'Thanks for coming in. Tell me about a deal you nearly lost and what you did.' },
  { id: 'i2', speaker: 'npc', text: 'At Brightline a renewal stalled on price. I went back to the users, found the feature they relied on, and we renewed at the same rate.' },
  { id: 'i3', speaker: 'you', text: 'How did you keep the account team in the loop?' }
];
const NOTES_A = 'Ask: how she forecasts a quarter.\nStrong on discovery, specific example.\nCheck: CRM habits.';
const NOTES_B = 'Good demo story.\nVague on a lost deal, ask again.';

const interview = (turns: StageTurn[], initialNotes = '') => function Render() {
  const [notes, setNotes] = useState(initialNotes);
  return <Stage><InterviewStage candidate={ANA} position={{ n: 1, total: 2 }} turns={turns} notes={notes} onNotes={setNotes} onReplay={noop}  /></Stage>;
};

/** First candidate, the opening question asked, Mandy thinking. Neutral ring: no mood is read from a face. */
export const InterviewFirstCandidate: StoryObj = { render: interview([INTERVIEW[0], { id: 'i2', speaker: 'npc', text: '', streaming: true }]) };
/** Mid interview with your notes. Mandy is answering: captions under the portrait, the line streams into the transcript. */
export const InterviewNotes: StoryObj = { render: interview([...INTERVIEW, { id: 'i4', speaker: 'npc', text: 'Every Friday I sent a short note with', streaming: true }], NOTES_A) };

const compare = (decided: CompareDecision | null = null) => function Render() {
  const [done, setDone] = useState<CompareDecision | null>(decided);
  return <Stage><CompareView candidates={[ANA, PETER]} notes={{ mandy: NOTES_A, peter: NOTES_B }} onHire={id => setDone({ kind: 'hire', id })} onPassBoth={() => setDone({ kind: 'passBoth' })} decided={done}  /></Stage>;
};

/** After two interviews: CV fields and your notes side by side, Hire or Pass for each. Marking one Hire marks the other Pass. */
export const InterviewCompare: StoryObj = { render: compare() };
/** Confirmed: Mandy hired, Peter passed. */
export const InterviewCompareHired: StoryObj = { render: compare({ kind: 'hire', id: 'mandy' }) };
/** Confirmed: a pass on both. */
export const InterviewComparePassBoth: StoryObj = { render: compare({ kind: 'passBoth' }) };

/* Plan */

const EMPTY: PlanFields = { goals: '', measures: '', owner: '', due: null, support: '' };
const FILLED: PlanFields = {
  goals: 'Kent and Beth share the older accounts without losing a renewal, and lead routing is agreed with the team.',
  measures: 'All 12 handed over accounts have a logged call by the due day. No renewal slips.',
  owner: 'Kent, with Beth',
  due: 5,
  support: 'Priya to approve the routing change. An hour of CRM admin time to fix account ownership.'
};
const CHECK_IN: StageTurn[] = [
  { id: 'p1', speaker: 'npc', text: 'I like that the measure is a number. Twelve calls by Friday is tight, though.' },
  { id: 'p2', speaker: 'you', text: 'Agreed. If we miss it, the renewals come first.' },
  { id: 'p3', speaker: 'npc', text: 'Then say that in the plan. And ask Priya before Thursday, not after.' }
];

const plan = (p: Partial<PlanFormProps> & { initial?: PlanFields; dictate?: PlanTextField }) => function Render() {
  const { initial = EMPTY, dictate = null, submitted: startSubmitted = false, checkIn = CHECK_IN, ...rest } = p;
  const [fields, setFields] = useState<PlanFields>(initial);
  const [dictating, setDictating] = useState<PlanTextField | null>(dictate);
  const levels = useLevels(!!dictating);
  const [submitted, setSubmitted] = useState(startSubmitted);
  const onChange = <K extends PlanField>(field: K, value: PlanFields[K]) => setFields(f => ({ ...f, [field]: value }));
  return (
    <Stage>
      <PlanForm fields={fields} onChange={onChange} onDictate={f => setDictating(d => (d === f ? null : f))} dictating={dictating} levels={levels}
        period={2} dueOptions={[3, 4, 5]} periodUnit="week" subPeriodUnit="day" reviewer={KENT} onSubmit={() => setSubmitted(true)} submitted={submitted}
        checkIn={submitted ? checkIn : []} onReplay={noop} {...rest} />
    </Stage>
  );
};

/** Nothing written yet. Submit shows what is missing and moves focus to the first gap. */
export const PlanEmpty: StoryObj = { render: plan({}) };
/** Every field filled, due Day 5. */
export const PlanFilled: StoryObj = { render: plan({ initial: FILLED }) };
/** Dictating Measures: the mic is on, the listening strip sits under the field, and the transcript stays editable. */
export const PlanDictating: StoryObj = { render: plan({ initial: { ...FILLED, measures: 'All 12 handed over accounts have a logged call', support: '' }, dictate: 'measures' }) };
/** Submitted: the plan reads only, and Kent's 2 minute check in runs beside it. */
export const PlanSubmittedCheckIn: StoryObj = { render: plan({ initial: FILLED, submitted: true }) };
/** Just submitted: Kent is reading the plan. */
export const PlanSubmittedReading: StoryObj = { render: plan({ initial: FILLED, submitted: true, checkIn: [{ id: 'p0', speaker: 'npc', text: '', streaming: true }] }) };
/** A month storyline: due options are the weeks left in Month 2. */
export const PlanMonthStoryline: StoryObj = { render: plan({ initial: { ...FILLED, due: 3 }, period: 2, dueOptions: [2, 3, 4], periodUnit: 'month', subPeriodUnit: 'week' }) };

