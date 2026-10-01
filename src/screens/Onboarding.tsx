import { useEffect, useRef, useState } from 'react';
import type { ScreenProps } from '../app/types';
import { NoWrapButton } from '../ds/Button';
import { css, pseudo } from '../lib/css';

/** Port of `project/ilOnboarding.dc.html`. */
export interface OnboardingProps extends ScreenProps {
  /** Initial step: lang, sponsor, consent, voice, how or team. */
  step?: string;
  /** Gallery states: `heard` / `micDenied` (voice), `read` (team). */
  uiState?: string;
}

const STEPS = ['lang', 'sponsor', 'consent', 'voice', 'how', 'team'] as const;
type Step = (typeof STEPS)[number];

const isStep = (v: string | undefined): v is Step => !!v && (STEPS as readonly string[]).includes(v);

interface State {
  step: Step;
  lang: number;
  tab: number;
  wait: number;
  listening: boolean;
  heardN: number;
  voiceOk: boolean;
  wave: number[];
  open: string | null;
  read: string[];
  micDenied: boolean;
}

type Update = Partial<State> | ((s: State) => Partial<State> | null);

const flatWave = () => Array<number>(28).fill(4);

/** Mirrors the logic class's state plus what componentDidMount derives from props. */
function initialState(step: string | undefined, uiState: string | undefined): State {
  const st: State = { step: 'lang', lang: 0, tab: 0, wait: 4, listening: false, heardN: 0, voiceOk: false, wave: flatWave(), open: null, read: [], micDenied: false };
  if (isStep(step)) st.step = step;
  if (uiState === 'micDenied') st.micDenied = true;
  if (uiState === 'heard') {
    st.heardN = 5;
    st.voiceOk = true;
  }
  if (isStep(step) && step === 'team' && uiState === 'read') {
    st.open = 'kent';
    st.read = ['kent', 'beth', 'green'];
  }
  return st;
}

const WORDS = ["I'm", 'ready', 'to', 'lead', 'my team.'];

const TABS_BODY = [
  ['Welcome to Northwind. I am glad you are here.', 'You are taking over a team of ten across our sales funnel, from first call to signed deal. Some are thriving, some are new, and one or two are struggling.', 'I care about two things: the number, and whether the team is stronger when you leave than when you arrived.'],
  ['Northwind sells workflow software to mid size companies. A typical deal is about $8,000 and takes four to six weeks to close.', 'Deals move through five stages: lead generation, qualification, solution demo, proposal and closing.'],
  ['Reach $240,000 in revenue over eight weeks.', 'Keep Team Morale and Trust healthy. A burned out team will not hold the number next quarter.', 'You have five days of your own time each week. Spend them well.']
];

const LANGS: Array<[string, string]> = [
  ['English', 'Voice and captions'],
  ['Español', 'Voz y subtítulos'],
  ['Bahasa Indonesia', 'Suara dan teks']
];

const TAB_NAMES = ['Welcome', 'About the product', 'Your targets'];

const CAPTION = 'Welcome to Northwind. I am glad you are here.';

const CONSENT = [
  { t: 'What we record', d: 'Your typed replies and, if you use voice, transcripts of what you say. Audio itself is not kept.' },
  { t: 'Why', d: 'AI reads your words to decide how each person reacts, and to write your development report.' },
  { t: 'How long', d: 'Kept for 12 months, then deleted. You can ask for deletion sooner.' },
  { t: 'Who sees the report', d: 'You, and your program manager at Northwind. Never your real colleagues.' }
];

const HOW = [
  { n: '1', t: 'The weekly loop', d: 'Each week, set a style for each person, spend your 5 days on actions, then see how the team responds.', art: 'linear-gradient(135deg,#249DFF,#43D6E8)' },
  { n: '2', t: 'Quick or live', d: 'Some actions are instant decisions. Live ones open a real conversation you have by voice or text.', art: 'linear-gradient(135deg,#43D6E8,#00F2AD)' },
  { n: '3', t: 'The clock', d: 'The clock is there to help you pace yourself. It pauses during conversations and whenever you pause.', art: 'linear-gradient(135deg,#DEE9FF,#9FDCEB)' },
  { n: '4', t: 'How you are evaluated', d: 'Results matter, and so does how you got there. Your report shows what you did well and what to try next.', art: 'linear-gradient(135deg,#249DFF 0%,#43D6E8 50%,#00F2AD 100%)' }
].map((h, j) => ({ ...h, border: j === 0 ? 'var(--ik-acc-2)' : 'var(--ik-line)', lift: j === 0 ? 'translateY(-6px)' : 'none' }));

const portrait = (id: string) => `/assets/npc/${id}.png`;

export function Onboarding({ d: D, act, app, step, uiState }: OnboardingProps) {
  const [s, setRaw] = useState<State>(() => initialState(step, uiState));
  /** class component style setState: merges, `null` from an updater is a no-op. */
  const setState = (u: Update) =>
    setRaw(prev => {
      const patch = typeof u === 'function' ? u(prev) : u;
      return patch ? { ...prev, ...patch } : prev;
    });
  const lt = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const wt = setInterval(() => setRaw(x => (x.step === 'sponsor' && x.wait > 0 ? { ...x, wait: x.wait - 1 } : x)), 1000);
    return () => {
      clearInterval(wt);
      clearInterval(lt.current);
    };
  }, []);

  const next = () => {
    const i = STEPS.indexOf(s.step);
    if (i < STEPS.length - 1) setState({ step: STEPS[i + 1] });
  };
  const textOnly = () => {
    act.say('Text only it is. You can turn voice on any time in Settings.');
    setState({ step: 'how' });
  };
  const toggleMic = () => {
    if (s.micDenied) return;
    if (s.listening) {
      clearInterval(lt.current);
      setState({ listening: false, wave: flatWave() });
      return;
    }
    setState({ listening: true, heardN: 0 });
    let t = 0;
    clearInterval(lt.current);
    lt.current = setInterval(() => {
      t++;
      setState(x => ({ wave: x.wave.map(() => 6 + Math.round(Math.random() * 30)), heardN: Math.min(5, Math.floor(t / 4)) }));
      if (t > 22) {
        clearInterval(lt.current);
        setState({ listening: false, voiceOk: true, wave: flatWave() });
      }
    }, 100);
  };

  const i = STEPS.indexOf(s.step);
  const dots = STEPS.map((_, j) => ({ w: j === i ? '28px' : '10px', bg: j <= i ? 'var(--grad-brand)' : 'var(--ik-track)' }));
  const tabBody = TABS_BODY[s.tab];
  const waitLock = s.wait > 0;
  const waitText = s.wait > 0 ? `Next unlocks in ${s.wait}s, or when the video ends` : '';
  const vTitle = s.micDenied ? 'We could not reach your mic' : s.voiceOk ? 'We heard you clearly' : 'Let us check we can hear you';
  const micAria = s.listening ? 'Stop listening' : 'Start mic test';
  const micBg = s.micDenied ? 'var(--ik-track)' : 'var(--grad-brand)';
  const micGlow = s.listening ? '0 0 50px oklch(0.75 0.14 220 / 0.7)' : '0 0 24px oklch(0.75 0.14 220 / 0.35)';
  const heard = WORDS.slice(0, s.heardN).join(' ');
  const rest = (s.heardN ? ' ' : '') + WORDS.slice(s.heardN).join(' ');
  const op = D.members.find(m => m.id === s.open);
  const team = D.members.map(m => {
    const r = s.read.includes(m.id);
    const stage = D.stages[m.stage].n;
    return {
      id: m.id,
      name: m.name,
      img: portrait(m.id),
      stage,
      read: r,
      border: s.open === m.id ? 'var(--ik-acc-2)' : 'var(--ik-line)',
      statsLine: r ? `Skill ${m.skill} · Morale ${m.morale} · Result ${m.result}` : 'Open to see stats',
      aria: `${m.name}, ${stage}${r ? ', read' : ''}`,
      open: () => setState(x => ({ open: m.id, read: x.read.includes(m.id) ? x.read : [...x.read, m.id] }))
    };
  });
  const readText = `${Math.min(3, s.read.length)} of 3 profiles read`;
  const teamLock = s.read.length < 3;

  return (
    <div style={css(`flex:1; min-height:${app.minH}; display:flex; flex-direction:column; padding:20px 32px 32px; gap:20px`)}>
      <header style={css('display:flex; align-items:center; gap:20px')}>
        <span style={css('font-size:22px; font-weight:700; letter-spacing:-0.03em; background:var(--grad-brand); -webkit-background-clip:text; background-clip:text; color:transparent')}>iLead</span>
        <span style={css('font-size:13px; color:var(--ik-text-2)')}>a Business Simulation</span>
        <span style={css('flex:1')}></span>
        <div aria-label={`Step ${i + 1} of 6`} style={css('display:flex; gap:6px')}>
          {dots.map((dt, j) => (
            <span key={j} style={css(`width:${dt.w}; height:6px; border-radius:3px; background:${dt.bg}; transition:width 240ms ease`)}></span>
          ))}
        </div>
        <span style={css('font-size:12px; color:var(--ik-text-2)')}>The clock starts after onboarding</span>
      </header>

      {s.step === 'lang' && (
        <div style={css('flex:1; display:flex; align-items:center; justify-content:center')}>
          <div style={css('width:640px; max-width:100%; display:flex; flex-direction:column; gap:24px; animation:ilIn 300ms ease')}>
            <span style={css('font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--ik-acc-2)')}>Welcome aboard</span>
            <h1 style={css('margin:0; font-size:48px; line-height:1.05; font-weight:700; letter-spacing:-0.03em')}>Lead a sales team of ten, for eight weeks.</h1>
            <p style={css('margin:0; font-size:17px; color:var(--ik-text-2); text-wrap:pretty')}>About 100 minutes in total. You can pause at any time and resume on any device.</p>
            <div role="radiogroup" aria-label="Language" style={css('display:grid; grid-template-columns:repeat(3,1fr); gap:10px')}>
              {LANGS.map(([n, d], j) => {
                const on = s.lang === j;
                return (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={on}
                    onClick={() => setState({ lang: j })}
                    style={css(`padding:14px; border-radius:16px; border:1.5px solid ${on ? 'var(--ik-acc-2)' : 'var(--ik-line)'}; background:${on ? 'var(--ik-acc-soft)' : 'var(--ik-card)'}; color:var(--ik-text); text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:2px`)}
                  >
                    <b>{n}</b>
                    <span style={css('font-size:12px; color:var(--ik-text-2)')}>{d}</span>
                  </button>
                );
              })}
            </div>
            <div>
              <NoWrapButton variant="primary" size="lg" onClick={next}>Let's begin</NoWrapButton>
            </div>
          </div>
        </div>
      )}

      {s.step === 'sponsor' && (
        <div style={css('flex:1; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.1fr); gap:40px; align-items:center; animation:ilIn 300ms ease')}>
          <div style={css('position:relative; aspect-ratio:4 / 5; max-height:640px; border-radius:28px; overflow:hidden; background:linear-gradient(160deg,#249DFF,#43D6E8 60%,#00F2AD); display:flex; align-items:center; justify-content:center')}>
            <span style={css('font-size:120px; font-weight:700; color:#0A081B; opacity:.85')}>PN</span>
            <span style={css('position:absolute; top:16px; left:16px; font-size:12px; font-weight:700; color:#0A081B')}>Sponsor avatar video from GenieKreator config</span>
            <div style={css('position:absolute; left:16px; right:16px; bottom:16px; padding:12px 14px; border-radius:16px; background:oklch(0.13 0.03 285 / 0.82); color:#fff; display:flex; gap:12px; align-items:center')}>
              <button onClick={() => act.say('Playing Priya’s welcome with captions.')} aria-label="Play welcome video" style={css('width:40px; height:40px; flex:none; border-radius:50%; border:0; background:#fff; color:#0A081B; cursor:pointer')}>▶</button>
              <span style={css('font-size:13px')}>“<span>{CAPTION}</span>”</span>
            </div>
          </div>
          <div style={css('display:flex; flex-direction:column; gap:20px')}>
            <div style={css('display:flex; flex-direction:column; gap:4px')}>
              <span style={css('font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--ik-acc-2)')}>A message from your sponsor</span>
              <h1 style={css('margin:0; font-size:40px; font-weight:700; letter-spacing:-0.03em')}>Priya Nair</h1>
              <span style={css('color:var(--ik-text-2)')}>Regional Sales Director, Northwind Software</span>
            </div>
            <div role="tablist" style={css('display:flex; gap:2px; padding:3px; border-radius:999px; background:var(--ik-raised); border:1px solid var(--ik-line); align-self:flex-start')}>
              {TAB_NAMES.map((n, j) => {
                const on = s.tab === j;
                return (
                  <button
                    key={n}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setState({ tab: j })}
                    style={css(`height:34px; padding:0 16px; border:0; border-radius:999px; font-size:13px; font-weight:700; white-space:nowrap; cursor:pointer; background:${on ? 'var(--grad-brand)' : 'transparent'}; color:${on ? '#0A081B' : 'var(--ik-text-2)'}`)}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div style={css('display:flex; flex-direction:column; gap:12px; min-height:200px')}>
              {tabBody.map((p, j) => (
                <p key={j} style={css('margin:0; font-size:16px; line-height:1.65; text-wrap:pretty')}>{p}</p>
              ))}
            </div>
            <div style={css('display:flex; align-items:center; gap:14px')}>
              <NoWrapButton variant="primary" size="lg" disabled={waitLock} onClick={next}>Next</NoWrapButton>
              <span style={css('font-size:13px; color:var(--ik-text-2)')}>{waitText}</span>
            </div>
          </div>
        </div>
      )}

      {s.step === 'consent' && (
        <div style={css('flex:1; display:flex; align-items:center; justify-content:center')}>
          <div style={css('width:720px; max-width:100%; padding:32px; border-radius:28px; background:var(--ik-card); backdrop-filter:blur(14px); border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:20px; animation:ilIn 300ms ease')}>
            <h1 style={css('margin:0; font-size:32px; font-weight:700; letter-spacing:-0.02em')}>Before you start, here is what we record</h1>
            <div style={css('display:grid; grid-template-columns:1fr 1fr; gap:12px')}>
              {CONSENT.map(c => (
                <div key={c.t} style={css('padding:14px; border-radius:16px; background:var(--ik-raised); display:flex; flex-direction:column; gap:4px')}>
                  <b>{c.t}</b>
                  <span style={css('font-size:13px; color:var(--ik-text-2); text-wrap:pretty')}>{c.d}</span>
                </div>
              ))}
            </div>
            <span style={css('font-size:13px; color:var(--ik-text-2)')}>If you choose text only, you can play the whole simulation and turn voice on later in Settings.</span>
            <div style={css('display:flex; gap:10px')}>
              <NoWrapButton variant="primary" size="lg" onClick={next}>Accept and use voice</NoWrapButton>
              <NoWrapButton variant="secondary" size="lg" onClick={textOnly}>Continue with text only</NoWrapButton>
            </div>
          </div>
        </div>
      )}

      {s.step === 'voice' && (
        <div style={css('flex:1; display:flex; align-items:center; justify-content:center')}>
          <div style={css('width:720px; max-width:100%; display:flex; flex-direction:column; gap:20px; align-items:center; text-align:center; animation:ilIn 300ms ease')}>
            <span style={css('font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--ik-acc-2)')}>Voice setup · about 30 seconds</span>
            <h1 style={css('margin:0; font-size:36px; font-weight:700; letter-spacing:-0.02em')}>{vTitle}</h1>
            {s.micDenied && (
              <div role="alert" style={css('width:100%; padding:16px; border-radius:18px; background:var(--ik-warn-soft); border:1px solid var(--ik-warn); display:flex; flex-direction:column; gap:6px; text-align:left')}>
                <b>Your browser blocked the microphone</b>
                <span style={css('font-size:13px')}>Click the lock icon in the address bar, set Microphone to Allow, then try again. Or carry on in text, nothing is lost.</span>
              </div>
            )}
            <button onClick={toggleMic} aria-label={micAria} aria-pressed={s.listening} style={css(`position:relative; width:120px; height:120px; border-radius:50%; border:0; background:${micBg}; color:#0A081B; cursor:pointer; box-shadow:${micGlow}; display:flex; align-items:center; justify-content:center`)}>
              {s.listening && <span style={css('position:absolute; inset:-10px; border-radius:50%; border:2px solid var(--ik-acc-2); animation:ilRing 1.4s ease-out infinite')}></span>}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <path d="M12 19v3"></path>
              </svg>
            </button>
            <div style={css('display:flex; gap:3px; align-items:center; height:40px')} aria-hidden="true">
              {s.wave.map((w, j) => (
                <span key={j} style={css(`width:4px; height:${w}px; border-radius:2px; background:var(--ik-acc-2); transition:height 90ms linear`)}></span>
              ))}
            </div>
            <div style={css('padding:14px 18px; border-radius:16px; background:var(--ik-card); border:1px solid var(--ik-line); min-width:420px; font-size:18px')}>
              <span style={css('color:var(--ik-text-2)')}>Say: </span>“<b>{heard}</b>
              <span style={css('color:var(--ik-text-2)')}>{rest}</span>”
            </div>
            <div style={css('display:flex; gap:10px; align-items:center')}>
              <NoWrapButton variant="secondary" size="md" onClick={() => act.say('Kent: “Hi, good to meet you.” Captions on.')}>Play a sample voice</NoWrapButton>
              <span style={css('font-size:13px; color:var(--ik-text-2)')}>Kent, with captions</span>
            </div>
            <div style={css('display:flex; gap:10px')}>
              <NoWrapButton variant="primary" size="lg" disabled={!s.voiceOk} onClick={next}>Sounds good</NoWrapButton>
              <NoWrapButton variant="ghost" size="lg" onClick={textOnly}>Skip, use text only</NoWrapButton>
            </div>
          </div>
        </div>
      )}

      {s.step === 'how' && (
        <div style={css('flex:1; display:flex; flex-direction:column; justify-content:center; gap:24px; animation:ilIn 300ms ease')}>
          <h1 style={css('margin:0; font-size:36px; font-weight:700; letter-spacing:-0.02em; text-align:center')}>How to play</h1>
          <div style={css('display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px')}>
            {HOW.map(h => (
              <div key={h.n} style={css(`padding:20px; border-radius:24px; background:var(--ik-card); backdrop-filter:blur(14px); border:1.5px solid ${h.border}; display:flex; flex-direction:column; gap:12px; transform:${h.lift}; transition:transform 240ms ease, border-color 240ms ease`)}>
                <div style={css(`height:120px; border-radius:16px; background:${h.art}; display:flex; align-items:flex-end; padding:12px`)}>
                  <span style={css('font-size:44px; font-weight:700; color:#0A081B; line-height:1')}>{h.n}</span>
                </div>
                <b style={css('font-size:18px')}>{h.t}</b>
                <span style={css('font-size:14px; color:var(--ik-text-2); text-wrap:pretty')}>{h.d}</span>
              </div>
            ))}
          </div>
          <div style={css('display:flex; justify-content:center')}>
            <NoWrapButton variant="primary" size="lg" onClick={next}>Meet your team</NoWrapButton>
          </div>
        </div>
      )}

      {s.step === 'team' && (
        <div style={css('flex:1; display:grid; grid-template-columns:minmax(0,1fr) 380px; gap:24px; animation:ilIn 300ms ease')}>
          <div style={css('display:flex; flex-direction:column; gap:16px')}>
            <div style={css('display:flex; align-items:flex-end; justify-content:space-between; gap:16px')}>
              <div style={css('display:flex; flex-direction:column; gap:4px')}>
                <h1 style={css('margin:0; font-size:32px; font-weight:700; letter-spacing:-0.02em')}>Meet your team</h1>
                <span style={css('color:var(--ik-text-2)')}>Open at least 3 profiles. Stats appear once you have read someone's profile.</span>
              </div>
              <div style={css('display:flex; align-items:center; gap:14px')}>
                <span aria-live="polite" style={css('font-weight:700')}>{readText}</span>
                <NoWrapButton variant="primary" size="lg" disabled={teamLock} onClick={() => act.go('style')}>Start week 1</NoWrapButton>
              </div>
            </div>
            <div style={css('display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:14px')}>
              {team.map(m => (
                <button
                  key={m.id}
                  onClick={m.open}
                  aria-label={m.aria}
                  className={pseudo('hover', 'transform:translateY(-3px)')}
                  style={css(`padding:0; border-radius:20px; overflow:hidden; border:2px solid ${m.border}; background:var(--ik-card); color:var(--ik-text); cursor:pointer; text-align:left; display:flex; flex-direction:column; transition:transform 200ms ease`)}
                >
                  <div style={css('position:relative; height:150px; width:100%; background:linear-gradient(160deg,#DEE9FF,#9FDCEB)')}>
                    <img src={m.img} alt="" style={css('width:100%; height:100%; object-fit:cover; object-position:center 12%; mix-blend-mode:multiply')} />
                    {m.read && <span style={css('position:absolute; top:8px; right:8px; height:22px; padding:0 8px; border-radius:999px; background:#00F2AD; color:#0A081B; font-size:12px; font-weight:700; display:flex; align-items:center')}>Read</span>}
                  </div>
                  <div style={css('padding:10px 12px; display:flex; flex-direction:column')}>
                    <b style={css('font-size:14px')}>{m.name}</b>
                    <span style={css('font-size:12px; color:var(--ik-text-2)')}>{m.stage}</span>
                    <span style={css('font-size:12px; color:var(--ik-text-2); padding-top:4px')}>{m.statsLine}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <aside aria-label="Profile" style={css('border-radius:24px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); overflow:hidden; display:flex; flex-direction:column')}>
            {op && (
              <>
                <div style={css('display:flex; align-items:center; gap:16px; padding:22px 20px 4px')}>
                  <div style={css('width:112px; height:112px; flex:none; border-radius:50%; overflow:hidden; background:linear-gradient(160deg,#DEE9FF,#9FDCEB); box-shadow:0 0 0 3px var(--ik-line-strong)')}>
                    <img src={portrait(op.id)} alt={op.name} style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} />
                  </div>
                  <div style={css('display:flex; flex-direction:column')}>
                    <b style={css('font-size:22px')}>{op.name}</b>
                    <span style={css('font-size:13px; color:var(--ik-text-2)')}>{op.title}</span>
                  </div>
                </div>
                <div style={css('padding:18px 20px; display:flex; flex-direction:column; gap:12px; animation:ilIn 240ms ease')}>
                  <div style={css('display:grid; grid-template-columns:repeat(4,1fr); gap:8px')}>
                    {(
                      [
                        ['Skill', op.skill],
                        ['Morale', op.morale],
                        ['Result', op.result],
                        ['Trust', op.trust]
                      ] as const
                    ).map(([n, v]) => (
                      <div key={n} style={css('padding:8px; border-radius:12px; background:var(--ik-raised); display:flex; flex-direction:column')}>
                        <span style={css('font-size:12px; color:var(--ik-text-2)')}>{n}</span>
                        <b style={css('font-size:18px')}>{v}</b>
                      </div>
                    ))}
                  </div>
                  {[
                    { k: 'Previous', v: op.prev },
                    { k: 'Tenure', v: op.tenure },
                    { k: 'Experience', v: op.exp },
                    { k: 'Skills', v: op.skills },
                    { k: 'Remarks', v: op.remarks }
                  ].map(fa => (
                    <div key={fa.k} style={css('display:grid; grid-template-columns:100px 1fr; gap:10px; font-size:13px')}>
                      <span style={css('color:var(--ik-text-2)')}>{fa.k}</span>
                      <span>{fa.v}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!op && <div style={css('flex:1; display:flex; align-items:center; justify-content:center; padding:32px; text-align:center; color:var(--ik-text-2)')}>Pick someone to read their profile.</div>}
          </aside>
        </div>
      )}
    </div>
  );
}
