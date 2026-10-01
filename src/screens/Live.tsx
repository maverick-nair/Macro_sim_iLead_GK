import type { ChangeEvent, KeyboardEvent } from 'react';
import type { ScreenProps } from '../app/types';
import type { LiveVariant } from '../data/types';
import { css } from '../lib/css';
import { NoWrapButton } from '../ds/Button';
import { briefs, moodColors, moodWords, notePlaceholders, subs } from './live/content';
import { useLiveSession } from './live/useLiveSession';

/**
 * Live interaction shell: 1:1 AI RolePlay (voice and text), email composer,
 * team meeting and sponsor briefing. Port of `project/ilLive.dc.html`.
 */
export interface LiveProps extends ScreenProps {
  variant: LiveVariant;
  uiState?: string;
  mobile?: boolean;
}

interface Person {
  name: string;
  img: string;
  first: string;
}

const micPath = 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z';

export function Live(props: LiveProps) {
  const { d: D, app, act } = props;
  const { state: s, setState, scripts, startListen, stopListen, send } = useLiveSession(props);
  const S = scripts();
  const mobile = !!props.mobile;
  const v: LiveVariant = props.variant || 'roleplay';

  const mem = (id: string): Person => {
    if (id === 'sponsor') return { name: 'Priya Nair', img: '', first: 'Priya' };
    const m = app.members.find(x => x.id === id);
    if (!m) return { name: '', img: '', first: '' };
    return { name: m.name, img: m.img, first: m.name.split(' ')[0] };
  };
  const who = v === 'roleplay' ? app.who || 'kent' : v === 'sponsor' ? 'sponsor' : app.who || 'kent';
  const curLine = S.npc[Math.min(s.turn, S.npc.length - 1)];
  const lineWords = curLine.t.split(' ');
  const shown = s.phase === 'speaking' ? lineWords.slice(0, s.words).join(' ') : curLine.t;
  const log = s.log.map((t, idx) => {
    const isNpc = t.who === 'npc';
    const live = isNpc && idx === s.log.length - 1 && s.phase === 'speaking';
    const text = isNpc ? (live ? shown : S.npc[t.i].t) : t.text || S.user[t.i];
    return {
      text,
      ai: isNpc,
      meta: isNpc ? mem(S.npc[t.i].id).first : 'You',
      align: isNpc ? 'flex-start' : 'flex-end',
      justify: isNpc ? 'flex-start' : 'flex-end',
      radius: isNpc ? '18px 18px 18px 6px' : '18px 18px 6px 18px',
      bg: isNpc ? 'var(--ik-raised)' : 'var(--grad-brand)',
      color: isNpc ? 'var(--ik-text)' : '#0A081B',
      replay: () => act.say('Replaying with captions.')
    };
  });
  const voice = s.mode === 'voice' && !s.micDenied;
  const listening = s.phase === 'listening';
  const review = s.phase === 'review';
  const done = s.phase === 'done';
  const titles: Record<LiveVariant, string> = {
    roleplay: `1:1 with ${mem(who).name}`,
    meeting: 'Team meeting',
    sponsor: 'Sponsor briefing with Priya Nair',
    email: `Email to ${mem(app.who && app.who !== 'kent' ? app.who : 'kent').name}`
  };
  const showBrief = s.brief && (!mobile || v !== 'email');
  const spkId = S.npc[Math.min(s.turn, S.npc.length - 1)].id;
  const attendees = app.members
    .map(m => {
      const speaking = m.id === spkId && (s.phase === 'speaking' || s.phase === 'idle');
      return {
        n: m.name.split(' ')[0],
        img: m.img,
        speaking,
        hand: m.id === 'ruth' && !s.called && s.turn < 2,
        ring: speaking ? '#00F2AD' : 'transparent',
        glow: speaking ? '0 0 30px oklch(0.86 0.17 165 / 0.45)' : 'none'
      };
    })
    .slice(0, mobile ? 6 : 10);
  const stateLabel = s.micDenied
    ? 'Text mode'
    : listening
      ? 'Listening'
      : review
        ? s.poor
          ? 'Partial transcript'
          : 'Edit if you like, then send'
        : s.phase === 'speaking'
          ? `${mem(curLine.id).first} is speaking. Talk to interrupt.`
          : s.phase === 'thinking'
            ? 'Waiting for a reply'
            : done
              ? 'Conversation has reached a natural close'
              : voice
                ? 'Press the mic and speak'
                : 'Type your reply';

  // Values named as in the design's renderVals().
  const title = titles[v];
  const sub = subs[v];
  const titleSize = mobile ? '15px' : '17px';
  const hGap = mobile ? '10px' : '16px';
  const hPad = mobile ? '10px 14px' : '12px 24px';
  const isDesk = !mobile;
  const timer = `${Math.floor(s.secs / 60)}:${String(s.secs % 60).padStart(2, '0')}`;
  const pause = () => act.overlay('paused');
  const hintUsed = s.hint;
  const hintLabel = s.hint ? 'Hint used' : 'Hint';
  const hintC = s.hint ? 'var(--ik-text-2)' : 'var(--ik-text)';
  const takeHint = () => setState({ hint: true, brief: true });
  const hintOpen = s.hint;
  const modes = (
    [
      ['voice', 'Voice'],
      ['text', 'Text']
    ] as const
  ).map(([k, n]) => ({
    n,
    on: s.mode === k,
    bg: s.mode === k ? 'var(--grad-brand)' : 'transparent',
    color: s.mode === k ? '#0A081B' : 'var(--ik-text-2)',
    pick: () => setState({ mode: k, phase: s.phase === 'listening' ? 'review' : s.phase })
  }));
  const endVariant = done ? 'primary' : 'secondary';
  const endLabel = done ? 'End and see how it lands' : v === 'email' ? 'Discard' : 'End';
  const end = () => act.go('reacting');
  const offline = props.uiState === 'offline';
  const cols = mobile ? '1fr' : showBrief ? '300px minmax(0,1fr)' : 'auto minmax(0,1fr)';
  const bodyGap = mobile ? '10px' : '20px';
  const bodyPad = mobile ? '10px 12px 12px' : '20px 24px 24px';
  const toggleBrief = () => setState(x => ({ brief: !x.brief }));
  const brief = briefs[v];
  const stageCols = mobile ? '1fr' : 'minmax(0,1.2fr) minmax(300px,1fr)';
  const portrait = mobile ? '150px' : '230px';
  const capSize = mobile ? '15px' : '18px';
  const npc = mem(who);
  const moodC = moodColors[s.mood];
  const moodWord = moodWords[s.mood];
  const npcTalking = s.phase === 'speaking';
  const showCaption = app.settings.captions && s.phase !== 'thinking';
  const caption = shown;
  const capWho = mem(curLine.id).first;
  const streaming = s.phase === 'speaking';
  const thinking = s.phase === 'thinking' && !s.slow;
  const slow = s.slow;
  const retry = () => setState({ slow: false, phase: 'speaking', log: [...s.log, { who: 'npc', i: s.turn }] });
  const showTranscript = !mobile || s.log.length > 0;
  const meetCols = mobile ? 2 : 5;
  const callOn = () => {
    setState({ draft: S.user[1] });
    act.say('You invited Ruth to speak.');
  };
  const sponsorCols = mobile ? '1fr' : 'minmax(0,1fr) minmax(0,1fr)';
  const notes = s.notes.map((n, i) => ({
    v: n,
    ph: notePlaceholders[i],
    aria: `Point ${i + 1}`,
    on: (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setState(x => {
        const a = [...x.notes];
        a[i] = val;
        return { notes: a };
      });
    }
  }));
  const funnel = D.stages.map(st => ({
    n: st.n,
    v: `${st.count} / ${st.ideal}`,
    w: Math.round((st.count / 45) * 100) + '%',
    ideal: Math.round((st.ideal / 45) * 100) + '%'
  }));
  const fields = [
    { k: 'To', isChips: true, isText: false, chips: [{ n: 'Kent Goldberg', hasImg: true, img: '/assets/npc/kent.png', ini: '', bg: '#DEE9FF' }], dictAria: 'Dictate recipients' },
    { k: 'CC', isChips: true, isText: false, chips: [{ n: 'Beth Killiney', hasImg: true, img: '/assets/npc/beth.png', ini: '', bg: '#DEE9FF' }], dictAria: 'Dictate CC' },
    { k: 'Subject', isChips: false, isText: true, chips: [], dictAria: 'Dictate subject' }
  ];
  const onSubject = (e: ChangeEvent<HTMLInputElement>) => setState({ subject: e.target.value });
  const onBody = (e: ChangeEvent<HTMLTextAreaElement>) => setState({ body: e.target.value });
  const dictate = () => setState(x => ({ dictating: !x.dictating }));
  const waveSm = s.wave.slice(0, 12).map(w => Math.max(4, w / 2) + 'px');
  const showInput = v !== 'email';
  const toText = () => setState({ mode: 'text' });
  const editable = !listening;
  const onDraft = (e: ChangeEvent<HTMLTextAreaElement>) => setState({ draft: e.target.value });
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  const ph = done ? 'You can end the conversation when ready' : s.mode === 'text' || s.micDenied ? 'Type what you would say' : 'Your words appear here as you speak';
  const wave = s.wave.map(w => w + 'px');
  const canRedo = review && voice;
  const micAria = listening ? 'Stop and review' : 'Start speaking';
  const micOk = !s.micDenied;
  const micSize = voice ? (mobile ? '64px' : '60px') : '48px';
  const micBg = s.micDenied ? 'var(--ik-track)' : listening ? '#00F2AD' : voice ? 'var(--grad-brand)' : 'var(--ik-raised)';
  const micC = s.micDenied ? 'var(--ik-text-2)' : voice || listening ? '#0A081B' : 'var(--ik-text)';
  const micGlow = listening ? '0 0 40px oklch(0.86 0.17 165 / 0.6)' : voice ? '0 0 24px oklch(0.75 0.14 220 / 0.4)' : 'none';
  const mic = () => (listening ? stopListen() : startListen());
  const cantSend = listening || s.phase === 'thinking' || done;
  const sendBg = listening || done ? 'var(--ik-track)' : 'var(--grad-brand)';
  const barBorder = listening ? '#00F2AD' : 'var(--ik-line-strong)';
  const barGlow = listening ? '0 0 0 3px oklch(0.86 0.17 165 / 0.2)' : 'none';
  const stateC = listening ? 'var(--ik-pos)' : 'var(--ik-text-2)';
  const helper = s.micDenied
    ? 'Voice is never required. Everything works in text.'
    : voice
      ? 'Push to talk. Hold Space, or tap the mic. You can edit the transcript before it is sent.'
      : 'Press Enter to send, Shift and Enter for a new line.';

  return (
    <div style={css(`flex:1; min-height:${app.minH}; display:flex; flex-direction:column`)}>
      <header style={css(`display:flex; align-items:center; gap:${hGap}; padding:${hPad}; border-bottom:1px solid var(--ik-line); background:var(--ik-mat); backdrop-filter:blur(16px)`)}>
        <span aria-hidden="true" style={css('width:36px; height:36px; flex:none; border-radius:12px; background:var(--grad-brand); color:#0A081B; display:flex; align-items:center; justify-content:center')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d={micPath}></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          </svg>
        </span>
        <div style={css('display:flex; flex-direction:column; min-width:0; flex:1')}>
          <b style={css(`font-size:${titleSize}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis`)}>{title}</b>
          <span style={css('font-size:12px; color:var(--ik-text-2)')}>{sub}</span>
        </div>
        <button onClick={pause} aria-label="Pause" style={css('display:flex; align-items:center; gap:6px; height:34px; padding:0 12px; border-radius:999px; border:1px solid var(--ik-line); background:var(--ik-raised); color:var(--ik-text); font-size:13px; font-weight:700; cursor:pointer')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="4" width="5" height="16" rx="1"></rect>
            <rect x="14" y="4" width="5" height="16" rx="1"></rect>
          </svg>
          <span>{timer}</span>
        </button>
        {isDesk && (
          <>
            <span style={css('font-size:12px; color:var(--ik-text-2)')}>Main clock paused</span>
            <button onClick={takeHint} disabled={hintUsed} style={css(`height:34px; padding:0 14px; border-radius:999px; border:1px solid var(--ik-line); background:transparent; color:${hintC}; font-size:13px; font-weight:700; cursor:pointer`)}>
              {hintLabel}
            </button>
            <div role="radiogroup" aria-label="Input mode" style={css('display:flex; gap:2px; padding:3px; border-radius:999px; background:var(--ik-raised); border:1px solid var(--ik-line)')}>
              {modes.map((md, i) => (
                <button key={i} role="radio" aria-checked={md.on} onClick={md.pick} style={css(`height:28px; padding:0 12px; border:0; border-radius:999px; font-size:12px; font-weight:700; cursor:pointer; background:${md.bg}; color:${md.color}`)}>
                  {md.n}
                </button>
              ))}
            </div>
          </>
        )}
        <NoWrapButton variant={endVariant} size="md" onClick={end}>
          {endLabel}
        </NoWrapButton>
      </header>

      {offline && (
        <div role="alert" style={css('padding:10px 24px; background:var(--ik-warn-soft); border-bottom:1px solid var(--ik-warn); font-size:13px')}>
          <b>Connection lost.</b> Your draft is saved on this device. We will send it as soon as you are back online.
        </div>
      )}

      <div style={css(`flex:1; display:grid; grid-template-columns:${cols}; gap:${bodyGap}; padding:${bodyPad}; min-height:0`)}>
        {showBrief && (
          <aside aria-label="Your brief" style={css('border-radius:22px; background:var(--ik-card); backdrop-filter:blur(14px); border:1px solid var(--ik-line); padding:18px; display:flex; flex-direction:column; gap:14px; align-self:start')}>
            <div style={css('display:flex; justify-content:space-between; align-items:center')}>
              <span style={css('font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ik-text-2)')}>Your brief</span>
              <button onClick={toggleBrief} style={css('border:0; background:transparent; color:var(--ik-acc-2); font-size:12px; font-weight:700; cursor:pointer')}>
                Hide
              </button>
            </div>
            <div style={css('display:flex; flex-direction:column; gap:4px')}>
              <b style={css('font-size:12px; color:var(--ik-text-2)')}>Your goal</b>
              <span style={css('font-size:14px; font-weight:600; text-wrap:pretty')}>{brief.goal}</span>
            </div>
            {brief.rows.map((br, i) => (
              <div key={i} style={css('display:flex; flex-direction:column; gap:2px')}>
                <b style={css('font-size:12px; color:var(--ik-text-2)')}>{br.k}</b>
                <span style={css('font-size:13px; text-wrap:pretty')}>{br.v}</span>
              </div>
            ))}
            {hintOpen && (
              <div role="note" style={css('padding:12px; border-radius:14px; background:var(--ik-acc-soft); border:1px solid var(--ik-acc); font-size:13px; display:flex; flex-direction:column; gap:4px; animation:ilIn 240ms ease')}>
                <b>Coaching tip</b>
                <span>{brief.hint}</span>
              </div>
            )}
          </aside>
        )}
        {!showBrief && (
          <button onClick={toggleBrief} style={css('align-self:start; height:36px; padding:0 14px; border-radius:999px; border:1px solid var(--ik-line); background:var(--ik-card); color:var(--ik-text); font-size:13px; font-weight:700; cursor:pointer')}>
            Show brief
          </button>
        )}

        <section aria-label="Conversation" style={css('display:flex; flex-direction:column; gap:14px; min-width:0; min-height:0')}>
          {v === 'roleplay' && (
            <div style={css(`flex:1; display:grid; grid-template-columns:${stageCols}; gap:20px; min-height:0`)}>
              <div style={css('display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:12px')}>
                <div style={css(`position:relative; width:${portrait}; height:${portrait}`)}>
                  <div aria-hidden="true" style={css(`position:absolute; inset:-14px; border-radius:50%; background:conic-gradient(from 200deg, ${moodC}, transparent 40%, ${moodC} 70%, transparent); filter:blur(10px); opacity:.75; transition:background 600ms ease`)}></div>
                  {npcTalking && <div aria-hidden="true" style={css(`position:absolute; inset:-8px; border-radius:50%; border:2px solid ${moodC}; animation:ilRing 1.6s ease-out infinite`)}></div>}
                  <div style={css(`position:relative; width:100%; height:100%; border-radius:50%; overflow:hidden; background:linear-gradient(160deg,#DEE9FF,#9FDCEB); border:3px solid ${moodC}; transition:border-color 600ms ease`)}>
                    <img src={npc.img} alt={npc.name} style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} />
                  </div>
                </div>
                <span style={css('display:flex; align-items:center; gap:6px; height:26px; padding:0 12px; border-radius:999px; background:var(--ik-card); border:1px solid var(--ik-line); font-size:12px; font-weight:700')}>
                  <span style={css(`width:8px; height:8px; border-radius:50%; background:${moodC}`)}></span>
                  <span>{npc.first}</span>
                  {' seems '}
                  <span>{moodWord}</span>
                </span>
                {showCaption && (
                  <div aria-live="polite" style={css(`max-width:560px; padding:14px 18px; border-radius:20px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); font-size:${capSize}; line-height:1.5; text-align:center; text-wrap:pretty`)}>
                    <span style={css('display:block; font-size:12px; font-weight:700; color:var(--ik-text-2); margin-bottom:4px')}>
                      <span>{capWho}</span> · captions
                    </span>
                    <span>{caption}</span>
                    {streaming && <span style={css('display:inline-block; width:2px; height:18px; margin-left:3px; vertical-align:middle; background:var(--ik-acc-2); animation:ilPulse 0.9s infinite')}></span>}
                  </div>
                )}
                {thinking && (
                  <div role="status" style={css('display:flex; align-items:center; gap:8px; padding:10px 16px; border-radius:999px; background:var(--ik-card); border:1px solid var(--ik-line); font-size:13px; color:var(--ik-text-2)')}>
                    <span style={css('display:flex; gap:4px')}>
                      <span style={css('width:6px; height:6px; border-radius:50%; background:var(--ik-text-2); animation:ilDot 1.2s infinite')}></span>
                      <span style={css('width:6px; height:6px; border-radius:50%; background:var(--ik-text-2); animation:ilDot 1.2s infinite .15s')}></span>
                      <span style={css('width:6px; height:6px; border-radius:50%; background:var(--ik-text-2); animation:ilDot 1.2s infinite .3s')}></span>
                    </span>
                    <span>{npc.first}</span>
                    {' is thinking'}
                  </div>
                )}
                {slow && (
                  <div role="alert" style={css('display:flex; align-items:center; gap:10px; font-size:13px')}>
                    <span style={css('color:var(--ik-text-2)')}>{npc.first} is taking longer than usual.</span>
                    <button onClick={retry} style={css('height:30px; padding:0 12px; border-radius:999px; border:1px solid var(--ik-line-strong); background:transparent; color:var(--ik-text); font-weight:700; cursor:pointer')}>
                      Retry
                    </button>
                  </div>
                )}
              </div>
              {showTranscript && (
                <div aria-label="Transcript" style={css('border-radius:22px; background:var(--ik-card); backdrop-filter:blur(12px); border:1px solid var(--ik-line); display:flex; flex-direction:column; min-height:0; overflow:hidden')}>
                  <div style={css('display:flex; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--ik-line); font-size:12px; color:var(--ik-text-2)')}>
                    <b>Transcript</b>
                    <span>Saved to History</span>
                  </div>
                  <div style={css('flex:1; overflow:auto; padding:14px; display:flex; flex-direction:column; gap:10px')}>
                    {log.map((t, i) => (
                      <div key={i} style={css(`align-self:${t.align}; max-width:88%; display:flex; flex-direction:column; gap:4px`)}>
                        <div style={css(`padding:10px 14px; border-radius:${t.radius}; background:${t.bg}; color:${t.color}; font-size:14px; text-wrap:pretty`)}>{t.text}</div>
                        <span style={css(`font-size:12px; color:var(--ik-text-2); display:flex; gap:6px; align-items:center; justify-content:${t.justify}`)}>
                          <span>{t.meta}</span>
                          {t.ai && (
                            <>
                              <span style={css('display:flex; gap:3px; align-items:center')}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ik-acc-2)" strokeWidth="2.25" strokeLinejoin="round">
                                  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"></path>
                                </svg>
                                AI persona
                              </span>
                              <button onClick={t.replay} aria-label="Replay this line" style={css('border:0; background:transparent; padding:0; color:var(--ik-acc-2); font-size:12px; font-weight:700; cursor:pointer')}>
                                Replay
                              </button>
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {v === 'meeting' && (
            <>
              <div style={css(`flex:1; display:grid; grid-template-columns:repeat(${meetCols},minmax(0,1fr)); gap:10px; align-content:start`)}>
                {attendees.map((a, i) => (
                  <div key={i} style={css(`position:relative; aspect-ratio:4 / 3; border-radius:18px; overflow:hidden; background:linear-gradient(160deg,#DEE9FF,#9FDCEB); border:3px solid ${a.ring}; box-shadow:${a.glow}; transition:border-color 240ms ease, box-shadow 240ms ease`)}>
                    <img src={a.img} alt="" style={css('width:100%; height:100%; object-fit:cover; object-position:center 15%; mix-blend-mode:multiply')} />
                    <div style={css('position:absolute; inset:0; background:linear-gradient(180deg, transparent 55%, oklch(0.13 0.03 285 / 0.8))')}></div>
                    <span style={css('position:absolute; left:10px; bottom:8px; color:#fff; font-size:13px; font-weight:700')}>{a.n}</span>
                    {a.hand && (
                      <button onClick={callOn} style={css('position:absolute; top:8px; right:8px; height:28px; padding:0 10px; border-radius:999px; border:0; background:oklch(0.84 0.14 78); color:#0A081B; font-size:12px; font-weight:700; cursor:pointer')}>
                        Hand raised · Call on
                      </button>
                    )}
                    {a.speaking && <span style={css('position:absolute; top:8px; left:8px; height:24px; padding:0 10px; border-radius:999px; background:#00F2AD; color:#0A081B; font-size:12px; font-weight:700; display:flex; align-items:center')}>Speaking</span>}
                  </div>
                ))}
              </div>
              <div aria-live="polite" style={css('padding:14px 18px; border-radius:20px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); font-size:16px')}>
                <b style={css('font-size:12px; color:var(--ik-text-2); display:block')}>
                  <span>{capWho}</span> · captions
                </b>
                <span>{caption}</span>
              </div>
            </>
          )}

          {v === 'sponsor' && (
            <div style={css(`flex:1; display:grid; grid-template-columns:${sponsorCols}; gap:20px; align-content:start`)}>
              <div style={css('display:flex; flex-direction:column; gap:14px; align-items:center')}>
                <div style={css('position:relative; width:100%; max-width:420px; aspect-ratio:1 / 1; border-radius:28px; background:linear-gradient(160deg,#249DFF,#43D6E8 60%,#00F2AD); display:flex; align-items:center; justify-content:center')}>
                  <span style={css('font-size:110px; font-weight:700; color:#0A081B; opacity:.85')}>PN</span>
                  <span style={css('position:absolute; top:14px; left:16px; font-size:12px; font-weight:700; color:#0A081B')}>Sponsor avatar</span>
                  {npcTalking && <span style={css('position:absolute; inset:-6px; border-radius:32px; border:2px solid #43D6E8; animation:ilRing 1.6s ease-out infinite')}></span>}
                </div>
                <div aria-live="polite" style={css('width:100%; max-width:520px; padding:14px 18px; border-radius:20px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); font-size:16px; text-align:center')}>
                  <b style={css('font-size:12px; color:var(--ik-text-2); display:block')}>Priya · captions</b>
                  <span>{caption}</span>
                </div>
              </div>
              <div style={css('display:flex; flex-direction:column; gap:12px')}>
                <div style={css('padding:16px; border-radius:20px; background:var(--ik-card); border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:10px')}>
                  <b>Your three points</b>
                  <span style={css('font-size:12px; color:var(--ik-text-2)')}>Write these before you speak. Priya will ask about them.</span>
                  {notes.map((n, i) => (
                    <input key={i} value={n.v} onChange={n.on} placeholder={n.ph} aria-label={n.aria} style={css('height:40px; padding:0 12px; border-radius:12px; border:1px solid var(--ik-line-strong); background:var(--ik-raised); color:var(--ik-text); font-size:14px')} />
                  ))}
                </div>
                <div style={css('padding:16px; border-radius:20px; background:var(--ik-card); border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:8px')}>
                  <div style={css('display:flex; justify-content:space-between')}>
                    <b>Funnel this week</b>
                    <span style={css('font-size:12px; color:var(--ik-text-2)')}>Pinned for reference</span>
                  </div>
                  {funnel.map((fn, i) => (
                    <div key={i} style={css('display:grid; grid-template-columns:110px 1fr 54px; gap:8px; align-items:center; font-size:12px')}>
                      <span style={css('color:var(--ik-text-2)')}>{fn.n}</span>
                      <div style={css('position:relative; height:8px; border-radius:4px; background:var(--ik-track)')}>
                        <div style={css(`height:100%; width:${fn.w}; border-radius:4px; background:linear-gradient(90deg,var(--ik-acc),var(--ik-acc-2))`)}></div>
                        <div style={css(`position:absolute; top:-3px; bottom:-3px; left:${fn.ideal}; width:2px; background:var(--ik-text)`)}></div>
                      </div>
                      <b style={css('text-align:right')}>{fn.v}</b>
                    </div>
                  ))}
                  <span style={css('font-size:12px; color:var(--ik-text-2)')}>Tick marks the ideal. Revenue $41,200 of $240,000.</span>
                </div>
              </div>
            </div>
          )}

          {v === 'email' && (
            <div style={css('flex:1; border-radius:22px; background:var(--ik-card); backdrop-filter:blur(14px); border:1px solid var(--ik-line); display:flex; flex-direction:column; overflow:hidden')}>
              {fields.map((fd, i) => (
                <div key={i} style={css('display:flex; align-items:center; gap:10px; padding:10px 16px; border-bottom:1px solid var(--ik-line); min-height:52px')}>
                  <span style={css('width:56px; font-size:13px; color:var(--ik-text-2)')}>{fd.k}</span>
                  {fd.isChips && (
                    <div style={css('flex:1; display:flex; flex-wrap:wrap; gap:6px')}>
                      {fd.chips.map((c, j) => (
                        <span key={j} style={css('display:flex; align-items:center; gap:6px; height:30px; padding:0 10px 0 3px; border-radius:999px; background:var(--ik-raised); border:1px solid var(--ik-line); font-size:13px; font-weight:600; white-space:nowrap')}>
                          <span style={css(`width:24px; height:24px; border-radius:50%; overflow:hidden; background:${c.bg}; color:#0A081B; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center`)}>
                            {c.hasImg && <img src={c.img} alt="" style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} />}
                            {c.ini && <span>{c.ini}</span>}
                          </span>
                          <span>{c.n}</span>
                        </span>
                      ))}
                      <button style={css('height:30px; padding:0 10px; border-radius:999px; border:1px dashed var(--ik-line-strong); background:transparent; color:var(--ik-text-2); font-size:12px; font-weight:700; white-space:nowrap')}>Add from team</button>
                    </div>
                  )}
                  {fd.isText && <input value={s.subject} onChange={onSubject} aria-label="Subject" style={css('flex:1; height:36px; border:0; outline:0; background:transparent; color:var(--ik-text); font-size:15px; font-weight:600')} />}
                  <button aria-label={fd.dictAria} onClick={dictate} style={css('width:32px; height:32px; flex:none; border-radius:50%; border:1px solid var(--ik-line); background:var(--ik-raised); color:var(--ik-text-2); cursor:pointer; display:flex; align-items:center; justify-content:center')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d={micPath}></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    </svg>
                  </button>
                </div>
              ))}
              <div style={css('flex:1; position:relative; display:flex')}>
                <textarea value={s.body} onChange={onBody} aria-label="Email body" style={css('flex:1; min-height:260px; padding:16px; border:0; outline:0; resize:none; background:transparent; color:var(--ik-text); font-size:15px; line-height:1.65')}></textarea>
                {s.dictating && (
                  <div style={css('position:absolute; left:16px; right:16px; bottom:12px; padding:10px 14px; border-radius:14px; background:var(--ik-mat); border:1px solid var(--ik-acc); display:flex; align-items:center; gap:10px; font-size:13px')}>
                    <span style={css('display:flex; gap:2px; align-items:center; height:20px')}>
                      {waveSm.map((w, i) => (
                        <span key={i} style={css(`width:3px; height:${w}; border-radius:2px; background:var(--ik-acc-2)`)}></span>
                      ))}
                    </span>
                    Listening. Your words go into the body, you can edit before sending.
                  </div>
                )}
              </div>
              <div style={css('display:flex; align-items:center; gap:10px; padding:12px 16px; border-top:1px solid var(--ik-line)')}>
                <span style={css('font-size:12px; color:var(--ik-text-2)')}>Draft saved · Replies arrive in your inbox over the next sim day</span>
                <span style={css('flex:1')}></span>
                <NoWrapButton variant="primary" size="md" onClick={end}>
                  Send
                </NoWrapButton>
              </div>
            </div>
          )}

          {showInput && (
            <div style={css('display:flex; flex-direction:column; gap:8px')}>
              {s.micDenied && (
                <div role="alert" style={css('padding:12px 14px; border-radius:16px; background:var(--ik-warn-soft); border:1px solid var(--ik-warn); display:flex; align-items:center; gap:12px; font-size:13px; flex-wrap:wrap')}>
                  <span style={css('flex:1; min-width:200px')}>
                    <b>Your mic is blocked.</b> The conversation is intact. Allow the mic in your browser's address bar, or keep going in text.
                  </span>
                  <NoWrapButton variant="secondary" size="sm" onClick={toText}>
                    Continue in text
                  </NoWrapButton>
                </div>
              )}
              {s.poor && (
                <div role="alert" style={css('padding:10px 14px; border-radius:16px; background:var(--ik-raised); border:1px solid var(--ik-line-strong); font-size:13px')}>
                  <b>We did not catch all of that.</b> Fix the gaps below and send, or try again.
                </div>
              )}
              <div style={css(`display:flex; align-items:flex-end; gap:10px; padding:10px; border-radius:24px; background:var(--ik-mat); border:1px solid ${barBorder}; box-shadow:${barGlow}`)}>
                <div style={css('flex:1; display:flex; flex-direction:column; gap:4px; min-width:0')}>
                  <span style={css(`font-size:12px; font-weight:700; color:${stateC}; padding:0 8px`)}>{stateLabel}</span>
                  {listening && (
                    <div style={css('display:flex; align-items:center; gap:10px; padding:4px 8px; min-height:48px')}>
                      <span style={css('display:flex; gap:2px; align-items:center; height:36px')} aria-hidden="true">
                        {wave.map((w, i) => (
                          <span key={i} style={css(`width:3px; height:${w}; border-radius:2px; background:var(--ik-acc-2); transition:height 90ms linear`)}></span>
                        ))}
                      </span>
                      <span style={css('font-size:15px')}>{s.draft}</span>
                    </div>
                  )}
                  {editable && (
                    <textarea value={s.draft} onChange={onDraft} onKeyDown={onKey} placeholder={ph} aria-label="Your reply" rows={2} style={css('width:100%; padding:8px; border:0; outline:0; resize:none; background:transparent; color:var(--ik-text); font-size:15px; line-height:1.5')}></textarea>
                  )}
                </div>
                {canRedo && (
                  <button onClick={startListen} aria-label="Record again" style={css('width:44px; height:44px; flex:none; border-radius:50%; border:1px solid var(--ik-line); background:var(--ik-raised); color:var(--ik-text); cursor:pointer')}>
                    ↺
                  </button>
                )}
                <button onClick={mic} disabled={s.micDenied} aria-label={micAria} aria-pressed={listening} style={css(`position:relative; width:${micSize}; height:${micSize}; flex:none; border-radius:50%; border:0; background:${micBg}; color:${micC}; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:${micGlow}`)}>
                  {listening && <span style={css('position:absolute; inset:-6px; border-radius:50%; border:2px solid var(--ik-acc-2); animation:ilRing 1.4s ease-out infinite')}></span>}
                  {s.micDenied && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="m2 2 20 20"></path>
                      <path d="M18.89 13.23A7 7 0 0 0 19 12v-2"></path>
                      <path d="M5 10v2a7 7 0 0 0 12 5"></path>
                      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"></path>
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12"></path>
                    </svg>
                  )}
                  {micOk && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d={micPath}></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                      <path d="M12 19v3"></path>
                    </svg>
                  )}
                </button>
                <button onClick={send} disabled={cantSend} aria-label="Send" style={css(`width:48px; height:48px; flex:none; border-radius:50%; border:0; background:${sendBg}; color:#0A081B; cursor:pointer; display:flex; align-items:center; justify-content:center`)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 14 0"></path>
                    <path d="m13 6 6 6-6 6"></path>
                  </svg>
                </button>
              </div>
              <span style={css('font-size:12px; color:var(--ik-text-2); padding:0 8px')}>{helper}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
