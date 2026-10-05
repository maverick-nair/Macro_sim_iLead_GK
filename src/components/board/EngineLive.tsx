import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAiStream } from '../../ai';
import type { EngineView, Intent, LiveView } from '../../engine/contract';
import { EngineError } from '../../engine/client';
import { useEngineClient, useIntent } from '../../engine/react';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { createSpeech, useSpeech } from '../../speech';
import type { MicState } from '../live/MicButton';
import { EmailStage, type EmailField } from '../liveshell/EmailStage';
import { LiveShell } from '../liveshell/LiveShell';
import { MeetingStage } from '../liveshell/MeetingStage';
import { RolePlayStage } from '../liveshell/RolePlayStage';
import { SponsorStage, type SponsorNote } from '../liveshell/SponsorStage';
import type { LiveBrief, LiveConversation, LiveFormat, LiveMode, LiveMood, LivePerson, LiveTurn } from '../liveshell/types';
import { ChatStage } from '../liveformats/ChatStage';
import { CompareView } from '../liveformats/CompareView';
import { InterviewStage, type Candidate } from '../liveformats/InterviewStage';
import { PlanForm, type PlanFields, type PlanTextField } from '../liveformats/PlanForm';
import type { StageNpc, StageTurn } from '../liveformats/shared';
import type { FinishLive } from './EngineBoard';

/**
 * A live interaction on the engine (spec, Live interaction screens). The engine holds the turns;
 * this screen streams each NPC turn as the AI writes it, lets the participant speak or type, and
 * sends intents: a turn, an interrupt, a hint, the end. It never scores anything. Ending goes
 * through the board (`onFinish`), which shows "The team is reacting" and then the outcome.
 */
export interface EngineLiveProps {
  view: EngineView;
  live: LiveView;
  /** The participant agreed to audio capture during onboarding (or in Settings). */
  voiceConsent: boolean;
  /** Preferred input: push to talk, open mic or text. */
  input: 'ptt' | 'open' | 'text';
  /** Captions on NPC speech (Settings); without them the transcript announces new turns. */
  captions?: boolean;
  /** The board is showing "The team is reacting" over this screen: the clock stops. */
  suspended?: boolean;
  /**
   * The run is paused (the app's pause dialog, or any app dialog): nothing moves. The NPC's words stop
   * where they are and carry on after, the interaction clock stops, and a recording is dropped.
   */
  held?: boolean;
  /** The timer's Pause opens the app's pause dialog (as in the design) instead of only stopping this clock. */
  onPause?: () => void;
  /** Ends the interaction with an evaluation: the board owns the reacting beat. Resolves false if the engine refused. */
  onFinish: FinishLive;
  /** Called once the interaction is left without an evaluation (nothing was said). */
  onDone: () => void;
  onError: (code: string) => void;
}

const PLACEHOLDER = '/assets/npc/placeholder.svg';
/** The polite "two minutes left" warning (Configuration Spec: soft stop). */
const WARN_SECONDS = 120;
/** Focus in one of these keeps Space and Enter for itself; elsewhere Space is push to talk (D18). */
const OWN_KEYS = 'input, textarea, select, button, a[href], [contenteditable="true"], [role="radio"], [role="checkbox"], [role="button"], [role="switch"], [role="tab"], [role="option"], [role="menuitem"]';

const moodRing = (m: LiveView['brief']['mood']): LiveMood => (m === 'frustrated' || m === 'concerned' ? (m === 'frustrated' ? 'frustrated' : 'guarded') : 'open');
const round1 = (n: number) => Math.round(n * 10) / 10;

export function EngineLive({ view: v, live: lv, voiceConsent, input, captions = true, suspended = false, held = false, onPause, onFinish, onDone, onError }: EngineLiveProps) {
  const { t } = useI18n();
  const client = useEngineClient();
  const intent = useIntent();
  const ai = useAiStream();
  const [mode, setMode] = useState<LiveMode>(input === 'text' || !voiceConsent ? 'text' : 'voice');
  const [draft, setDraft] = useState('');
  const [briefOpen, setBriefOpen] = useState(true);
  const [paused, setPaused] = useState(false);
  const startSeconds = Math.round(lv.minutes * 60);
  const [seconds, setSeconds] = useState(startSeconds);
  const [email, setEmail] = useState({ subject: '', body: '' });
  const [dictating, setDictating] = useState<EmailField | null>(null);
  const [notes, setNotes] = useState(['', '', '']);
  const [notesSent, setNotesSent] = useState(false);
  const streamed = useRef(new Set<string>());
  /** The NPC turn being streamed now (the stream store only learns its id at the end). */
  const [streamingTurn, setStreamingTurn] = useState<string | null>(null);
  /** The stream running now is a Replay: display only, so cutting it off tells the engine nothing. */
  const replaying = useRef(false);
  const [cvNotes, setCvNotes] = useState<Record<string, string>>({});
  const [comparing, setComparing] = useState(false);
  const [confirmPass, setConfirmPass] = useState(false);
  const [plan, setPlan] = useState<PlanFields>({ goals: '', measures: '', owner: '', due: null, support: '' });
  const [planField, setPlanField] = useState<PlanTextField | null>(null);
  const inFlight = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  /** What had focus when the pass confirmation opened (End), to return to if the participant keeps comparing. */
  const passOpener = useRef<HTMLElement | null>(null);

  const provider = useMemo(() => createSpeech(lv.format), [lv.format]);
  const speech = useSpeech(provider, {
    consented: voiceConsent,
    mode: input === 'open' ? 'openMic' : 'pushToTalk',
    onSpeechStart: () => { if (ai.streaming) interrupt(); }
  });

  // The interaction clock counts down while not paused (Configuration Spec: soft stop). Pausing is client side.
  useEffect(() => {
    if (paused || suspended || held) return;
    const id = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [paused, suspended, held]);

  // Paused: the streamed line holds where it is (not an interrupt), and a recording in progress is dropped.
  useEffect(() => {
    ai.hold(held);
    if (held && (speech.status === 'listening' || speech.status === 'requesting' || speech.status === 'finishing')) speech.cancel();
    // `ai.hold` is stable; this follows the pause only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held]);

  /** NPC turns whose stream ran to the end. */
  const finished = useRef(new Set<string>());
  const startStream = (turn: { id: string; text: string }, replay: boolean) => {
    replaying.current = replay;
    setStreamingTurn(turn.id);
    void ai.start(signal => client.streamTurn(lv.id, { id: turn.id, text: turn.text }, signal)).then(s => { if (s.done && !replay) finished.current.add(turn.id); });
  };

  // Stream each new NPC turn once, as the AI writes it. The cleanup stops it (a newer turn, leaving,
  // or StrictMode's test unmount); a turn that did not finish may then start again.
  const last = lv.turns[lv.turns.length - 1];
  useEffect(() => {
    const started = streamed.current, done = finished.current;
    if (!last || last.by === 'you' || started.has(last.id)) return;
    const id = last.id;
    started.add(id);
    startStream(last, false);
    return () => {
      ai.cancel();
      if (!done.has(id)) started.delete(id);
    };
    // `ai.start` and `ai.cancel` are stable; streaming restarts only for a new turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id]);

  // Focus lands where the participant acts: the reply box when typing, the screen's heading when
  // speaking (so Space can be push to talk), or the first field of a written format.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reply = el.querySelector<HTMLElement>(`textarea[aria-label=${JSON.stringify(t('liveshell.reply.aria'))}]`);
    const field = el.querySelector<HTMLElement>('section input:not([type="radio"]):not([type="checkbox"]), section textarea');
    const heading = el.closest('main')?.querySelector<HTMLElement>('h1');
    const target = mode === 'voice' && reply ? heading : reply ?? field ?? heading;
    target?.focus({ preventScroll: true });
    // Once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Sends one intent; a second while one is on its way is dropped (interrupts always go through). */
  const send = async (i: Intent) => {
    const guard = i.type !== 'interruptTurn';
    if (guard && inFlight.current) return null;
    if (guard) inFlight.current = true;
    try {
      return await intent.mutateAsync(i);
    } catch (e) {
      onError(e instanceof EngineError ? e.code : 'other');
      return null;
    } finally {
      if (guard) inFlight.current = false;
    }
  };

  /** Speaking over the NPC stops it; the engine keeps what was shown (spec, Interrupt). A replay only stops. */
  function interrupt() {
    if (!ai.streaming || !streamingTurn) return;
    const shown = ai.cancel();
    if (replaying.current) { replaying.current = false; return; }
    if (shown) void send({ type: 'interruptTurn', interactionId: lv.id, turnId: streamingTurn, shownChars: shown.rawLength });
  }

  /** Replays an NPC turn with captions. Display only: it streams the same words again. */
  const replay = (turnId: string) => {
    const turn = lv.turns.find(x => x.id === turnId);
    if (!turn || turn.by === 'you') return;
    if (ai.streaming) interrupt();
    startStream(turn, true);
  };

  // ---- view mapping ----
  const person = (w: { id: string; name: string; img: string | null }): LivePerson => {
    const m = v.members.find(x => x.id === w.id);
    return { id: w.id, name: w.name, img: w.img ?? PLACEHOLDER, pronoun: m?.pronoun };
  };
  const speaker = person(lv.speaker);
  const reactingPeople = [speaker, ...lv.people.filter(p => p.id !== speaker.id).slice(0, 2).map(person)];

  const finish = async (kind: 'end' | 'submit' | 'abandon', text?: string) => {
    if (ai.streaming) interrupt();
    if (kind === 'abandon') { if (await send({ type: 'abandonInteraction', interactionId: lv.id })) onDone(); return; }
    if (inFlight.current) return;
    await onFinish(kind === 'submit' && text
      ? { type: 'submitInteraction', interactionId: lv.id, text, usedVoice: mode === 'voice' }
      : { type: 'endInteraction', interactionId: lv.id }, reactingPeople);
  };

  /** Sends a turn. The words leave the reply box only once the engine has them. */
  /** Sends a turn. `typed` (what is in the reply box) is cleared only once the engine has the words. */
  const say = async (text: string, typed?: string): Promise<boolean> => {
    const words = text.trim();
    if (!words) return false;
    if (ai.streaming) interrupt();
    const r = await send({ type: 'sendTurn', interactionId: lv.id, text: words, usedVoice: mode === 'voice' });
    if (!r) return false;
    // Anything typed while the turn was on its way stays.
    if (typed !== undefined) setDraft(d => (d === typed ? '' : d));
    if (speech.status === 'review') speech.cancel();
    return true;
  };

  const onSend = () => {
    const text = speech.status === 'review' ? speech.transcript : draft;
    if (lv.format === 'sponsor' && !notesSent && notes.some(n => n.trim())) {
      void say([...notes.filter(n => n.trim()), text].filter(Boolean).join('. '), draft).then(ok => { if (ok) setNotesSent(true); });
      return;
    }
    if (lv.oneShot) void finish('submit', text);
    else void say(text, draft);
  };

  const onMicPress = () => {
    // Voice is off until the participant consents (Design doc, input rules): say where to turn it on.
    if (!voiceConsent) { setMode('text'); onError('noConsent'); return; }
    if (speech.status === 'listening') speech.stop();
    else void speech.start();
  };

  const byId = new Map([...lv.people, lv.speaker, ...(lv.candidates ?? [])].map(p => [p.id, p]));
  const streamingId = ai.streaming ? streamingTurn : null;
  const turns: LiveTurn[] = lv.turns.map(turn => {
    const live = turn.id === streamingId;
    return {
      id: turn.id,
      speaker: turn.by === 'you' ? 'you' : person(byId.get(turn.by) ?? lv.speaker),
      text: live ? ai.text : turn.text,
      streaming: turn.id === streamingId,
      interrupted: turn.interrupted,
      aiGenerated: turn.aiGenerated
    };
  });
  // The caption follows the line being spoken (a replay included), else the latest NPC line.
  const current = turns.find(x => x.streaming) ?? turns.filter(x => x.speaker !== 'you').pop();
  const npcLine = current && current.speaker !== 'you' ? { name: current.speaker.name.split(' ')[0], text: current.text, streaming: current.streaming, aiGenerated: current.aiGenerated } : null;
  const caption = captions ? npcLine : null;
  // With captions off, stages without a transcript still have the line read out once it has finished.
  const spokenLine = captions ? undefined : npcLine;
  // At 0:00 time is up: the reply bar closes and End leads (soft stop). Written formats keep going.
  const timeUp = !lv.oneShot && seconds <= 0;
  const conversation: LiveConversation = ai.streaming ? 'npcSpeaking' : intent.isPending ? 'npcThinking' : lv.closed || lv.turnsLeft === 0 || timeUp ? 'closed' : 'yourTurn';
  const mic: MicState = speech.status === 'listening' || speech.status === 'finishing' ? 'listening' : speech.status === 'review' ? 'review' : speech.status === 'denied' || speech.status === 'unsupported' ? 'denied' : 'idle';
  const shellFormat: LiveFormat = lv.format;
  const action = v.actions.find(a => a.key === lv.actionKey);
  const planSent = lv.format === 'plan' && lv.turns.some(x => x.by === 'you');
  const npcOf = (p: LivePerson): StageNpc => ({ id: p.id, name: p.name, firstName: p.name.split(' ')[0], img: p.img, mood: lv.brief.mood ?? 'neutral' });
  const stageTurns = (list: LiveTurn[]): StageTurn[] => list.map(x => ({ id: x.id, speaker: x.speaker === 'you' ? 'you' : 'npc', text: x.text, streaming: x.streaming }));
  const candidateOf = (c: NonNullable<LiveView['candidates']>[number]): Candidate => ({
    id: c.id, name: c.name, firstName: c.name.split(' ')[0], title: c.title, img: c.img ?? PLACEHOLDER,
    cv: { previous: c.cv.previous, experience: c.cv.experience, skills: c.cv.skills.split(',').map(x => x.trim()).filter(Boolean), remarks: c.cv.remarks }
  });
  /** The turns from one candidate's interview: from their opening line to the next candidate's. */
  const segment = (list: LiveTurn[], id: string) => {
    const start = list.findIndex(x => x.speaker !== 'you' && x.speaker.id === id);
    if (start < 0) return [];
    const next = list.findIndex((x, i) => i > start && x.speaker !== 'you' && x.speaker.id !== id);
    return list.slice(start, next < 0 ? undefined : next);
  };
  const finishInterview = (id: string | null) => {
    setConfirmPass(false);
    if (inFlight.current) return;
    void onFinish({ type: 'chooseCandidate', interactionId: lv.id, candidateId: id }, reactingPeople);
  };

  const brief: LiveBrief = {
    goal: lv.brief.goal ?? lv.actionName ?? t('board.live.goal.reply'),
    known: lv.brief.known.length ? lv.brief.known : undefined,
    mood: lv.brief.mood ? { key: lv.brief.mood } : undefined,
    promises: lv.format === 'meeting' || lv.format === 'sponsor' || lv.format === 'interview' ? undefined : lv.brief.promises,
    declaredStyle: lv.format === 'meeting' || lv.format === 'sponsor' || lv.format === 'interview' ? undefined : lv.brief.declaredStyle
  };

  // Dictation into an email field: the accepted transcript lands in that field.
  useEffect(() => {
    if (!planField || speech.status !== 'review') return;
    const said = speech.transcript.trim();
    if (said) setPlan(f => ({ ...f, [planField]: `${f[planField]} ${said}`.trim() }));
    speech.cancel();
    setPlanField(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.status]);
  useEffect(() => {
    if (!dictating || speech.status !== 'review') return;
    const said = speech.transcript.trim();
    if (said) setEmail(e => (dictating === 'subject' ? { ...e, subject: `${e.subject} ${said}`.trim() } : { ...e, body: `${e.body} ${said}`.trim() }));
    speech.cancel();
    setDictating(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.status]);

  const replyBar = !(shellFormat === 'email' || (shellFormat === 'plan' && !planSent) || comparing);

  // Push to talk (D18): hold Space anywhere that is not a field or a control to speak, release to
  // review; Enter then sends. Only with voice consent, in voice mode, while it is your turn.
  const ptt = useRef({ on: false, held: false, down: () => {}, up: () => {}, send: () => {} });
  useEffect(() => {
    ptt.current.on = voiceConsent && input === 'ptt' && mode === 'voice' && replyBar && conversation !== 'closed' && !suspended && !held && !confirmPass;
    ptt.current.down = () => { if (ai.streaming) interrupt(); void speech.start(); };
    ptt.current.up = () => { if (speech.status === 'listening') speech.stop(); };
    ptt.current.send = () => { if (speech.status === 'review' && conversation !== 'npcThinking') onSend(); };
  });
  useEffect(() => {
    const ownsKeys = (el: Element | null) => !!el && el instanceof HTMLElement && (el.isContentEditable || el.matches(OWN_KEYS));
    const onDown = (e: KeyboardEvent) => {
      const p = ptt.current;
      if (!p.on || ownsKeys(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat || p.held) return;
        p.held = true;
        p.down();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        p.send();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const p = ptt.current;
      if (e.code !== 'Space' || !p.held) return;
      e.preventDefault();
      p.held = false;
      p.up();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  const stage = (() => {
    switch (shellFormat) {
      case 'email':
        return (
          <EmailStage
            to={lv.people.map(person)} cc={[]} subject={email.subject} body={email.body}
            onSubject={subject => setEmail(e => ({ ...e, subject }))} onBody={body => setEmail(e => ({ ...e, body }))}
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
            attendees={lv.people.map(p => ({ ...person(p), speaking: !!current && current.speaker !== 'you' && current.speaker.id === p.id && conversation === 'npcSpeaking', raisedHand: lv.raisedHands.includes(p.id) }))}
            caption={caption} spokenLine={spokenLine} onCallOn={id => setDraft(t('board.live.callOn', { name: (byId.get(id)?.name ?? '').split(' ')[0] }))}
          />
        );
      case 'sponsor': {
        const prompts = [t('board.live.note.0'), t('board.live.note.1'), t('board.live.note.2')];
        // Throughput against the ideal throughput, per stage, from the engine.
        const stages = v.funnel.map(st => ({ key: st.key, name: st.name, count: round1(st.throughput), ideal: round1(st.idealThroughput) }));
        return (
          <SponsorStage
            sponsor={speaker} speaking={conversation === 'npcSpeaking'} caption={caption} spokenLine={spokenLine}
            notes={prompts.map((prompt, i) => ({ value: notes[i], prompt })) as [SponsorNote, SponsorNote, SponsorNote]}
            onNoteChange={(i, value) => setNotes(n => n.map((x, j) => (j === i ? value : x)))}
            funnel={{ periodUnit: v.clock.periodUnit, stages, scale: Math.max(1, ...stages.map(st => Math.max(st.ideal, st.count) * 1.25)) }}
            kpi={{ revenue: v.money.value, target: v.money.target }}
          />
        );
      }
      case 'chat':
        return <ChatStage npc={npcOf(speaker)} turns={stageTurns(turns)} ended={lv.closed ? 'npc' : null} periodUnit={v.clock.periodUnit} subPeriodUnit={v.clock.subPeriodUnit} />;
      case 'interview': {
        const cands = (lv.candidates ?? []).map(candidateOf);
        if (comparing && cands.length === 2) {
          return <CompareView candidates={[cands[0], cands[1]]} notes={cvNotes}
            onHire={id => finishInterview(id)} onPassBoth={() => finishInterview(null)} />;
        }
        const cand = cands[lv.candidate ?? 0];
        return cand ? (
          <InterviewStage candidate={cand} position={{ n: (lv.candidate ?? 0) + 1, total: cands.length }} onReplay={replay} captions={captions}
            turns={stageTurns(segment(turns, cand.id))} notes={cvNotes[cand.id] ?? ''} onNotes={n => setCvNotes(x => ({ ...x, [cand.id]: n }))} />
        ) : null;
      }
      case 'plan':
        return (
          <PlanForm
            fields={plan} onChange={(field, value) => setPlan(f => ({ ...f, [field]: value }))}
            onDictate={field => {
              if (planField === field) { speech.stop(); return; }
              setPlanField(field);
              void speech.start();
            }}
            dictating={planField} levels={speech.levels}
            period={v.clock.period} dueOptions={Array.from({ length: Math.max(1, v.clock.capacity - v.clock.subPeriod + 1) }, (_, i) => v.clock.subPeriod + i)}
            periodUnit={v.clock.periodUnit} subPeriodUnit={v.clock.subPeriodUnit}
            reviewer={npcOf(speaker)} submitted={planSent} checkIn={stageTurns(turns.slice(1))} onReplay={replay}
            onSubmit={() => void say([
              `${t('liveformats.plan.field', { field: 'goals' })}: ${plan.goals}`, `${t('liveformats.plan.field', { field: 'measures' })}: ${plan.measures}`, `${t('liveformats.plan.field', { field: 'owner' })}: ${plan.owner}`,
              plan.due ? `${t('liveformats.plan.due', { unit: v.clock.subPeriodUnit })}: ${t('time.subPeriod', { unit: v.clock.subPeriodUnit, n: plan.due })}` : '',
              plan.support ? `${t('liveformats.plan.field', { field: 'support' })}: ${plan.support}` : ''
            ].filter(Boolean).join('\n'))}
          />
        );
      default:
        return <RolePlayStage person={speaker} mood={moodRing(lv.brief.mood)} conversation={conversation} caption={caption} turns={turns} onReplay={replay} />;
    }
  })();

  const warn = !lv.oneShot && startSeconds > WARN_SECONDS && seconds > 0 && seconds <= WARN_SECONDS;
  const notice = timeUp ? t('board.live.timeUp') : warn ? t('board.live.timeWarning') : '';

  return (
    <div ref={root} className="flex flex-1 flex-col">
      <LiveShell
        format={shellFormat}
        personName={speaker.name}
        pronoun={speaker.pronoun}
        meta={{ cost: action?.cost ?? 0, costUnit: v.clock.subPeriodUnit, topic: lv.optionLabel ?? undefined, minutes: lv.minutes, action: lv.actionName ?? undefined }}
        timer={{ seconds, paused: paused || held }}
        onPause={onPause ?? (() => setPaused(p => !p))}
        mode={mode}
        onModeChange={m => { if (m === 'voice' && !voiceConsent) return; speech.cancel(); setMode(m); }}
        hint={lv.hint.mode === 'off' ? null : { available: !lv.hint.text, text: lv.hint.text, onRequest: () => void send({ type: 'requestHint', interactionId: lv.id }) }}
        endKind={lv.oneShot ? 'discard' : conversation === 'closed' ? 'finish' : 'end'}
        onEnd={() => {
          if (lv.format === 'interview') {
            // In the comparison, End asks before passing on both; the table's own button hires.
            if (comparing) { passOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setConfirmPass(true); return; }
            if ((lv.candidate ?? 0) + 1 < (lv.candidates?.length ?? 0)) void send({ type: 'nextCandidate', interactionId: lv.id });
            else if ((lv.candidates?.length ?? 0) === 2) setComparing(true);
            else finishInterview(lv.candidates?.[0]?.id ?? null);
            return;
          }
          const said = lv.turns.some(x => x.by === 'you');
          void finish(lv.oneShot || !said ? 'abandon' : 'end');
        }}
        brief={brief}
        briefOpen={briefOpen}
        onBriefToggle={() => setBriefOpen(o => !o)}
        input={!replyBar ? null : {
          mic, conversation, voiceInput: input === 'open' ? 'open' : 'ptt', speakerName: speaker.name.split(' ')[0],
          draft: speech.status === 'review' || speech.status === 'listening' ? speech.transcript || speech.partial : draft,
          onDraft: text => (speech.status === 'review' ? speech.setTranscript(text) : setDraft(text)),
          onSend, onMicPress, onRecordAgain: () => { speech.cancel(); void speech.start(); },
          levels: speech.levels
        }}
        onInterrupt={interrupt}
      >
        <div role="status" className={notice ? 'rounded-14 border border-status-attention bg-status-attention-soft px-3.5 py-2.5 text-13' : 'sr-only'}>{notice}</div>
        {stage}
      </LiveShell>
      <Dialog.Root open={confirmPass} onOpenChange={setConfirmPass}>
        <Dialog.Overlay className="fixed inset-0 z-48 flex items-center justify-center bg-surface-scrim p-6 backdrop-blur-12">
          <Dialog.Content aria-modal="true"
            onCloseAutoFocus={e => { const o = passOpener.current; if (o?.isConnected) { e.preventDefault(); o.focus(); } }}
            className="flex w-full max-w-(--il-board-panel-max-width) flex-col gap-3 rounded-26 border border-line-strong bg-surface-solid p-6 outline-0">
            <Dialog.Title className="m-0 text-22 font-700">{t('board.live.compareEnd.title')}</Dialog.Title>
            <Dialog.Description className="m-0 text-14 text-fg-secondary">{t('board.live.compareEnd.body')}</Dialog.Description>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => setConfirmPass(false)}>{t('board.live.compareEnd.keep')}</Button>
              <Button variant="primary" size="md" onClick={() => finishInterview(null)}>{t('board.live.compareEnd.pass')}</Button>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Root>
    </div>
  );
}
