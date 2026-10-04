import { useEffect, useMemo, useRef, useState } from 'react';
import { useAiStream } from '../../ai';
import type { EngineView, LiveView } from '../../engine/contract';
import { EngineError } from '../../engine/client';
import { useEngineClient, useIntent } from '../../engine/react';
import { useI18n } from '../../i18n';
import { createHttpTranscriptionClient, MediaRecorderSpeechProvider, MockSpeechProvider, useSpeech, type SpeechProvider } from '../../speech';
import type { MicState } from '../live/MicButton';
import { EmailStage, type EmailField } from '../liveshell/EmailStage';
import { LiveShell } from '../liveshell/LiveShell';
import { MeetingStage } from '../liveshell/MeetingStage';
import { ReactingScreen } from '../liveshell/ReactingScreen';
import { RolePlayStage } from '../liveshell/RolePlayStage';
import { SponsorStage, type SponsorNote } from '../liveshell/SponsorStage';
import type { LiveBrief, LiveConversation, LiveFormat, LiveMode, LiveMood, LivePerson, LiveTurn } from '../liveshell/types';

/**
 * A live interaction on the engine (spec, Live interaction screens). The engine holds the turns;
 * this screen streams each NPC turn as the AI writes it, lets the participant speak or type, and
 * sends intents: a turn, an interrupt, a hint, the end. It never scores anything.
 */
export interface EngineLiveProps {
  view: EngineView;
  live: LiveView;
  /** The participant agreed to audio capture during onboarding (or in Settings). */
  voiceConsent: boolean;
  /** Preferred input: push to talk, open mic or text. */
  input: 'ptt' | 'open' | 'text';
  /** Called once the interaction is over and the board should show the outcome. */
  onDone: () => void;
  onError: (code: string) => void;
}

const PLACEHOLDER = '/assets/npc/placeholder.svg';
/** The reacting beat lasts at least this long, so the evaluation reads as a moment (spec: about 3 seconds). */
const REACTING_MS = 1600;

/** Real capture with server transcription when configured; otherwise the scripted mock voice. */
function createSpeech(format: string): SpeechProvider {
  const url = import.meta.env.VITE_ILEAD_SPEECH_URL as string | undefined;
  if (url) return new MediaRecorderSpeechProvider({ transcription: createHttpTranscriptionClient(url) });
  const lines: Record<string, string> = {
    sponsor: 'We are behind on conversions, and I own that. The plan is to coach the bottleneck this week. I need support on lead quality.',
    meeting: 'Today we have three things. First the pipeline, then the new CRM. What do you all think?',
    interview: 'Tell me about a time you turned around a difficult client. What happened next?'
  };
  return new MockSpeechProvider({ script: lines[format] ?? 'Thanks for making time. How are things going for you this week? Let us agree one next step by Friday.' });
}

const moodRing = (m: LiveView['brief']['mood']): LiveMood => (m === 'frustrated' || m === 'concerned' ? (m === 'frustrated' ? 'frustrated' : 'guarded') : 'open');

export function EngineLive({ view: v, live: lv, voiceConsent, input, onDone, onError }: EngineLiveProps) {
  const { t } = useI18n();
  const client = useEngineClient();
  const intent = useIntent();
  const ai = useAiStream();
  const [mode, setMode] = useState<LiveMode>(input === 'text' || !voiceConsent ? 'text' : 'voice');
  const [draft, setDraft] = useState('');
  const [briefOpen, setBriefOpen] = useState(true);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(Math.round(lv.minutes * 60));
  const [reacting, setReacting] = useState(false);
  const [email, setEmail] = useState({ subject: '', body: '' });
  const [dictating, setDictating] = useState<EmailField | null>(null);
  const [notes, setNotes] = useState(['', '', '']);
  const [notesSent, setNotesSent] = useState(false);
  const streamed = useRef(new Set<string>());

  const provider = useMemo(() => createSpeech(lv.format), [lv.format]);
  const speech = useSpeech(provider, {
    consented: voiceConsent,
    mode: input === 'open' ? 'openMic' : 'pushToTalk',
    onSpeechStart: () => { if (ai.streaming) interrupt(); }
  });

  // The interaction clock counts down while not paused (Configuration Spec: soft stop).
  useEffect(() => {
    if (paused || reacting) return;
    const id = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [paused, reacting]);

  // Stream each new NPC turn once, as the AI writes it.
  const last = lv.turns[lv.turns.length - 1];
  useEffect(() => {
    if (!last || last.by === 'you' || streamed.current.has(last.id)) return;
    streamed.current.add(last.id);
    ai.start(signal => client.streamTurn(lv.id, { id: last.id, text: last.text }, signal));
    // `ai.start` is stable; streaming restarts only for a new turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id]);

  const send = async (i: Parameters<typeof intent.mutateAsync>[0]) => {
    try {
      return await intent.mutateAsync(i);
    } catch (e) {
      onError(e instanceof EngineError ? e.code : 'other');
      return null;
    }
  };

  /** Speaking over the NPC stops it; the engine keeps what was shown (spec, Interrupt). */
  function interrupt() {
    if (!ai.streaming || !ai.turnId) return;
    const shown = ai.cancel();
    if (shown) void send({ type: 'interruptTurn', interactionId: lv.id, turnId: shown.turnId ?? ai.turnId, shownChars: shown.rawLength });
  }

  const finish = async (kind: 'end' | 'submit' | 'abandon', text?: string) => {
    if (ai.streaming) interrupt();
    if (kind === 'abandon') { if (await send({ type: 'abandonInteraction', interactionId: lv.id })) onDone(); return; }
    setReacting(true);
    const started = Date.now();
    const r = kind === 'submit' && text
      ? await send({ type: 'submitInteraction', interactionId: lv.id, text, usedVoice: mode === 'voice' })
      : await send({ type: 'endInteraction', interactionId: lv.id });
    await new Promise(res => setTimeout(res, Math.max(0, REACTING_MS - (Date.now() - started))));
    setReacting(false);
    if (r) onDone();
  };

  const say = async (text: string) => {
    const words = text.trim();
    if (!words) return;
    if (ai.streaming) interrupt();
    setDraft('');
    speech.cancel();
    await send({ type: 'sendTurn', interactionId: lv.id, text: words, usedVoice: mode === 'voice' });
  };

  const onSend = () => {
    const text = speech.status === 'review' ? speech.transcript : draft;
    if (lv.format === 'sponsor' && !notesSent && notes.some(n => n.trim())) {
      setNotesSent(true);
      void say([...notes.filter(n => n.trim()), text].filter(Boolean).join('. '));
      return;
    }
    if (lv.oneShot) void finish('submit', text);
    else void say(text);
  };

  const onMicPress = () => {
    // Voice is off until the participant consents (Design doc, input rules): say where to turn it on.
    if (!voiceConsent) { setMode('text'); onError('noConsent'); return; }
    if (speech.status === 'listening') speech.stop();
    else void speech.start();
  };

  // ---- view mapping ----
  const person = (w: { id: string; name: string; img: string | null }): LivePerson => {
    const m = v.members.find(x => x.id === w.id);
    return { id: w.id, name: w.name, img: w.img ?? PLACEHOLDER, pronoun: m?.pronoun };
  };
  const speaker = person(lv.speaker);
  const byId = new Map([...lv.people, lv.speaker, ...(lv.candidates ?? [])].map(p => [p.id, p]));
  const streamingId = ai.streaming ? ai.turnId : null;
  const turns: LiveTurn[] = lv.turns.map(turn => {
    const live = turn.id === streamingId || (turn.id === ai.turnId && !ai.done && !ai.cancelled);
    return {
      id: turn.id,
      speaker: turn.by === 'you' ? 'you' : person(byId.get(turn.by) ?? lv.speaker),
      text: live ? ai.text : turn.text,
      streaming: turn.id === streamingId,
      interrupted: turn.interrupted,
      aiGenerated: turn.aiGenerated
    };
  });
  const current = turns.filter(x => x.speaker !== 'you').pop();
  const caption = current ? { name: (current.speaker as LivePerson).name.split(' ')[0], text: current.text, streaming: current.streaming, aiGenerated: current.aiGenerated } : null;
  const conversation: LiveConversation = ai.streaming ? 'npcSpeaking' : intent.isPending ? 'npcThinking' : lv.closed || lv.turnsLeft === 0 ? 'closed' : 'yourTurn';
  const mic: MicState = speech.status === 'listening' || speech.status === 'finishing' ? 'listening' : speech.status === 'review' ? 'review' : speech.status === 'denied' || speech.status === 'unsupported' ? 'denied' : 'idle';
  const shellFormat: LiveFormat = lv.format === 'email' || lv.format === 'meeting' || lv.format === 'sponsor' ? lv.format : 'roleplay';
  const action = v.actions.find(a => a.key === lv.actionKey);
  const brief: LiveBrief = {
    goal: lv.brief.goal ?? lv.actionName ?? t('board.live.goal.reply'),
    known: lv.brief.known.length ? lv.brief.known : undefined,
    mood: lv.brief.mood ? { key: lv.brief.mood } : undefined,
    promises: lv.format === 'meeting' || lv.format === 'sponsor' ? undefined : lv.brief.promises,
    declaredStyle: lv.format === 'meeting' || lv.format === 'sponsor' ? undefined : lv.brief.declaredStyle
  };

  // Dictation into an email field: the accepted transcript lands in that field.
  useEffect(() => {
    if (!dictating || speech.status !== 'review') return;
    const said = speech.transcript.trim();
    if (said) setEmail(e => (dictating === 'subject' ? { ...e, subject: `${e.subject} ${said}`.trim() } : { ...e, body: `${e.body} ${said}`.trim() }));
    speech.cancel();
    setDictating(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.status]);

  if (reacting) return <ReactingScreen people={[speaker, ...lv.people.filter(p => p.id !== speaker.id).slice(0, 2).map(person)]} />;

  const stage = (() => {
    switch (shellFormat) {
      case 'email':
        return (
          <EmailStage
            to={lv.people.map(person)} cc={[]} subject={email.subject} body={email.body}
            onSubject={subject => setEmail(e => ({ ...e, subject }))} onBody={body => setEmail(e => ({ ...e, body }))}
            onAddRecipient={() => undefined}
            onDictate={field => {
              if (dictating === field) { speech.stop(); setDictating(null); return; }
              setDictating(field);
              void speech.start();
            }}
            dictating={dictating} levels={speech.levels}
            onSend={() => void finish('submit', [email.subject, email.body].filter(Boolean).join('\n'))}
            subUnit={v.clock.subPeriodUnit}
          />
        );
      case 'meeting':
        return (
          <MeetingStage
            attendees={lv.people.map(p => ({ ...person(p), speaking: !!current && current.speaker !== 'you' && (current.speaker as LivePerson).id === p.id && conversation === 'npcSpeaking', raisedHand: false }))}
            caption={caption} onCallOn={id => setDraft(t('board.live.callOn', { name: (byId.get(id)?.name ?? '').split(' ')[0] }))}
          />
        );
      case 'sponsor': {
        const prompts = [t('board.live.note.0'), t('board.live.note.1'), t('board.live.note.2')];
        return (
          <SponsorStage
            sponsor={speaker} speaking={conversation === 'npcSpeaking'} caption={caption}
            notes={prompts.map((prompt, i) => ({ value: notes[i], prompt })) as [SponsorNote, SponsorNote, SponsorNote]}
            onNoteChange={(i, value) => setNotes(n => n.map((x, j) => (j === i ? value : x)))}
            funnel={{ periodUnit: v.clock.periodUnit, stages: v.funnel.map(st => ({ key: st.key, name: st.name, count: st.members, ideal: st.ideal })), scale: Math.max(3, ...v.funnel.map(st => st.ideal + 1)) }}
            kpi={{ revenue: v.money.value, target: v.money.target }}
          />
        );
      }
      default:
        return <RolePlayStage person={speaker} mood={moodRing(lv.brief.mood)} conversation={conversation} caption={caption} turns={turns} />;
    }
  })();

  return (
    <LiveShell
      format={shellFormat}
      personName={speaker.name}
      pronoun={speaker.pronoun}
      meta={{ cost: action?.cost ?? 0, costUnit: v.clock.subPeriodUnit, topic: lv.optionLabel ?? undefined, minutes: lv.minutes }}
      timer={{ seconds, paused }}
      onPause={() => setPaused(p => !p)}
      mode={mode}
      onModeChange={m => { if (m === 'voice' && !voiceConsent) return; speech.cancel(); setMode(m); }}
      hint={lv.hint.mode === 'off' ? null : { available: !lv.hint.text, text: lv.hint.text, onRequest: () => void send({ type: 'requestHint', interactionId: lv.id }) }}
      endKind={lv.oneShot ? 'discard' : conversation === 'closed' ? 'finish' : 'end'}
      onEnd={() => {
        const said = lv.turns.some(x => x.by === 'you');
        void finish(lv.oneShot || !said ? 'abandon' : 'end');
      }}
      brief={brief}
      briefOpen={briefOpen}
      onBriefToggle={() => setBriefOpen(o => !o)}
      input={shellFormat === 'email' ? null : {
        mic, conversation, voiceInput: input === 'open' ? 'open' : 'ptt', speakerName: speaker.name.split(' ')[0],
        draft: speech.status === 'review' || speech.status === 'listening' ? speech.transcript || speech.partial : draft,
        onDraft: text => (speech.status === 'review' ? speech.setTranscript(text) : setDraft(text)),
        onSend, onMicPress, onRecordAgain: () => { speech.cancel(); void speech.start(); },
        levels: speech.levels
      }}
      onInterrupt={interrupt}
    >
      {stage}
    </LiveShell>
  );
}
