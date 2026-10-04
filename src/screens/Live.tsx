import type { ScreenProps } from '../app/types';
import type { LiveVariant } from '../data/types';
import { css } from '../lib/css';
import { briefs, funnelScale, metas, moods, notePlaceholders, sponsorKpi } from './live/content';
import { micStateOf, useLiveSession, type LivePhase } from './live/useLiveSession';
import { LiveShell, type LiveEndKind } from '../components/liveshell/LiveShell';
import { RolePlayStage } from '../components/liveshell/RolePlayStage';
import { MeetingStage } from '../components/liveshell/MeetingStage';
import { SponsorStage } from '../components/liveshell/SponsorStage';
import { EmailStage } from '../components/liveshell/EmailStage';
import type { LiveConversation, LiveLayout, LivePerson, LiveTurn } from '../components/liveshell/types';

/**
 * Live interaction screen: 1:1 AI RolePlay (voice and text), email composer, team meeting and
 * sponsor briefing. Port of `project/ilLive.dc.html`, rendered with the live shell components.
 * This screen only shapes the simulated session (useLiveSession) into the components' data.
 */
export interface LiveProps extends ScreenProps {
  variant: LiveVariant;
  uiState?: string;
  mobile?: boolean;
}

const conversationOf = (phase: LivePhase): LiveConversation =>
  phase === 'speaking' ? 'npcSpeaking' : phase === 'thinking' ? 'npcThinking' : phase === 'done' ? 'closed' : 'yourTurn';

const pronounOf = (pron: string | undefined): LivePerson['pronoun'] => (pron === 'him' ? 'he' : pron === 'her' ? 'she' : 'they');

export function Live(props: LiveProps) {
  const { d: D, app, act } = props;
  const { state: s, setState, scripts, startListen, stopListen, send } = useLiveSession(props);
  const S = scripts();
  const mobile = !!props.mobile;
  const layout: LiveLayout = mobile ? 'phone' : 'desktop';
  const v: LiveVariant = props.variant || 'roleplay';

  const mem = (id: string): LivePerson => {
    if (id === 'sponsor') return { id, name: D.sponsor.name, img: '', pronoun: 'she' };
    const m = app.members.find(x => x.id === id);
    if (!m) return { id, name: '', img: '' };
    return { id, name: m.name, img: m.img, pronoun: pronounOf(m.pron) };
  };
  const first = (id: string) => mem(id).name.split(' ')[0];
  const who = v === 'sponsor' ? 'sponsor' : app.who || 'kent';
  const curLine = S.npc[Math.min(s.turn, S.npc.length - 1)];
  const speaking = s.phase === 'speaking';
  const shown = speaking ? curLine.t.split(' ').slice(0, s.words).join(' ') : curLine.t;
  const turns: LiveTurn[] = s.log.map((t, idx) => {
    const isNpc = t.who === 'npc';
    const live = isNpc && idx === s.log.length - 1 && speaking;
    return {
      id: String(idx),
      speaker: isNpc ? mem(S.npc[t.i].id) : 'you',
      text: isNpc ? (live ? shown : S.npc[t.i].t) : t.text || S.user[t.i],
      streaming: live,
      aiGenerated: isNpc
    };
  });
  const caption = { name: first(curLine.id), text: shown, streaming: speaking, aiGenerated: true };
  const recipient = mem(app.who && app.who !== 'kent' ? app.who : 'kent');
  const person = v === 'email' ? recipient : v === 'meeting' ? null : mem(who);
  const showBrief = s.brief && (!mobile || v !== 'email');
  const endKind: LiveEndKind = s.phase === 'done' ? 'finish' : v === 'email' ? 'discard' : 'end';
  const end = () => act.go('reacting');
  const callOn = () => {
    setState({ draft: S.user[1] });
    act.say('You invited Ruth to speak.');
  };
  const replay = () => act.say('Replaying with captions.');
  const note = (i: number) => ({ value: s.notes[i] ?? '', prompt: notePlaceholders[i] });

  const stage = {
    roleplay: () => (
      <RolePlayStage person={mem(who)} mood={moods[s.mood]} conversation={conversationOf(s.phase)} layout={layout}
        caption={app.settings.captions && s.phase !== 'thinking' ? caption : null}
        slow={s.slow} onRetry={() => setState({ slow: false, phase: 'speaking', log: [...s.log, { who: 'npc', i: s.turn }] })}
        turns={turns} onReplay={replay} />
    ),
    meeting: () => {
      const speakerId = curLine.id;
      const attendees = app.members
        .map(m => ({
          id: m.id, name: m.name, img: m.img,
          speaking: m.id === speakerId && (s.phase === 'speaking' || s.phase === 'idle'),
          raisedHand: m.id === 'ruth' && !s.called && s.turn < 2
        }))
        .slice(0, mobile ? 6 : 10);
      return <MeetingStage attendees={attendees} caption={caption} onCallOn={callOn} layout={layout} />;
    },
    sponsor: () => (
      <SponsorStage sponsor={mem('sponsor')} speaking={speaking} caption={caption} layout={layout}
        notes={[note(0), note(1), note(2)]}
        onNoteChange={(i, val) => setState(x => { const a = [...x.notes]; a[i] = val; return { notes: a }; })}
        funnel={{ periodUnit: 'week', stages: D.stages.map(st => ({ key: st.k, name: st.n, count: st.count, ideal: st.ideal })), scale: funnelScale }}
        kpi={sponsorKpi} />
    ),
    email: () => (
      <EmailStage to={[recipient]} cc={[mem('beth')]} subject={s.subject} body={s.body}
        onSubject={val => setState({ subject: val })} onBody={val => setState({ body: val })}
        onAddRecipient={() => undefined} onDictate={() => setState(x => ({ dictating: !x.dictating }))}
        dictating={s.dictating ? 'body' : null} levels={s.wave.slice(0, 12).map(w => Math.max(4, w / 2))} onSend={end} />
    )
  }[v];

  return (
    <div style={css(`min-height:${app.minH}; display:flex; flex-direction:column`)}>
      <LiveShell
        format={v} personName={person?.name ?? ''} pronoun={v === 'sponsor' ? 'she' : person?.pronoun} meta={metas[v]} layout={layout}
        timer={{ seconds: s.secs, paused: false }} onPause={() => act.overlay('paused')}
        mode={s.mode} onModeChange={mode => setState({ mode, phase: s.phase === 'listening' ? 'review' : s.phase })}
        hint={{ available: !s.hint, text: s.hint ? briefs[v].hint : null, onRequest: () => setState({ hint: true, brief: true }) }}
        endKind={endKind} onEnd={end} offline={props.uiState === 'offline'}
        brief={briefs[v].brief} briefOpen={showBrief} onBriefToggle={() => setState(x => ({ brief: !x.brief }))}
        onInterrupt={() => setState({ words: 999 })}
        input={v === 'email' ? null : {
          mic: micStateOf(s), conversation: conversationOf(s.phase), voiceInput: app.settings.input === 'open' ? 'open' : 'ptt',
          speakerName: first(curLine.id), draft: s.draft, onDraft: draft => setState({ draft }), onSend: send,
          onMicPress: () => (s.phase === 'listening' ? stopListen() : startListen()), onRecordAgain: startListen,
          levels: s.wave, partial: s.poor
        }}>
        {stage()}
      </LiveShell>
    </div>
  );
}
