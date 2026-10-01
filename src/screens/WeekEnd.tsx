import { useId, useState } from 'react';
import type { ScreenProps } from '../app/types';
import { css } from '../lib/css';
import { NoWrapButton } from '../ds/Button';

/** Week end flow, ported from `project/ilWeekEnd.dc.html`. */
export interface WeekEndProps extends ScreenProps {
  /** Initial step: banner, report, badge, unlock or news. Read once on mount, like the design. */
  step?: string;
}

const STEPS = ['banner', 'report', 'badge', 'unlock', 'news'] as const;
type Step = (typeof STEPS)[number];

const isStep = (s: string | undefined): s is Step => !!s && (STEPS as readonly string[]).includes(s);

const NEWS = [
  { t: 'A competitor cut prices by 10%', d: 'Two of your open deals mention it. Expect tougher proposal conversations.', impact: 'Proposal and Closing stages will convert a little slower unless the team sells value.', art: 'linear-gradient(135deg,#249DFF,#43D6E8)' },
  { t: 'Ashcroft signed at list price', d: 'Jack and Green held the line. Priya sent a note to the whole team.', impact: 'Revenue +$8,400. Morale lifts for Jack and Green.', art: 'linear-gradient(135deg,#43D6E8,#00F2AD)' }
];

const STAR_POINTS = '12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3';

const STARS = [0, 1, 2].map(i => ({
  gid: 'wg' + i,
  delay: i * 0.18 + 's',
  filled: i < 2,
  stroke: i < 2 ? 'transparent' : 'var(--ik-line-strong)'
}));

const KPIS = ([['Team skill', 56, 57], ['Team morale', 54, 58], ['Team result', 58, 60], ['Team trust', 53, 57]] as const).map(([n, a, b]) => ({
  n,
  a,
  b,
  d: (b - a > 0 ? '+' : '') + (b - a),
  c: b - a > 0 ? 'var(--ik-pos)' : 'var(--ik-text-2)'
}));

const STAR_ROWS = [
  { t: 'People star', d: 'Lifted team morale by 4 points' },
  { t: 'Leadership star', d: 'Matched your style to 7 of 10 people' },
  { t: 'Business star, not yet', d: 'Hit week 2 revenue pace. You were $18,800 short.' }
].map((r, i) => ({ ...r, fill: i < 2 ? '#43D6E8' : 'transparent', stroke: i < 2 ? '#43D6E8' : 'var(--ik-line-strong)' }));

const REWARDS = [
  { n: 'An extra half day', d: 'Five and a half days of your time in week 3.', art: 'linear-gradient(135deg,#249DFF,#43D6E8)' },
  { n: 'A quiet word', d: 'Learn one thing a team member has not told you yet.', art: 'linear-gradient(135deg,#43D6E8,#00F2AD)' },
  { n: 'Team lunch budget', d: 'Energize the team once in week 3 at no day cost.', art: 'linear-gradient(135deg,#DEE9FF,#9FDCEB)' }
];

const CARD = 'padding:20px; border-radius:24px; background:var(--ik-card); backdrop-filter:blur(14px); border:1px solid var(--ik-line); display:flex; flex-direction:column;';
const EYEBROW = 'font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--ik-acc-2)';

export function WeekEnd({ d, app, act, step: initialStep }: WeekEndProps) {
  // Gradient ids must be unique per page, the screens gallery renders many week ends at once.
  const uid = useId().replace(/:/g, '');
  const [step, setStep] = useState<Step>(() => (isStep(initialStep) ? initialStep : 'banner'));
  const [reward, setReward] = useState<number | null>(null);
  const [newsIdx, setNewsIdx] = useState(0);
  const [impact, setImpact] = useState(false);

  const next = () => setStep(s => STEPS[Math.min(STEPS.indexOf(s) + 1, 4)]);
  const toEnd = () => act.go('end');

  const funnel = d.stages.map((st, i) => ({
    n: st.n,
    v: `${st.count} of ${st.ideal}`,
    w: Math.round((st.count / 45) * 100) + '%',
    ideal: Math.round((st.ideal / 45) * 100) + '%',
    bg: i === 4 ? 'var(--ik-warn)' : 'linear-gradient(90deg,var(--ik-acc),var(--ik-acc-2))'
  }));

  const news = NEWS[newsIdx];
  const newsPos = `${newsIdx + 1} of ${NEWS.length}`;
  const newsCta = newsIdx === NEWS.length - 1 ? 'Set styles for week 3' : 'Next';
  const prevNews = () => {
    setNewsIdx(x => Math.max(0, x - 1));
    setImpact(false);
  };
  const nextNews = () => {
    if (newsIdx < NEWS.length - 1) {
      setNewsIdx(newsIdx + 1);
      setImpact(false);
    } else act.go('style');
  };

  return (
    <div style={css(`flex:1; min-height:${app.minH}; display:flex; flex-direction:column; padding:20px 32px 32px; gap:20px; position:relative`)}>
      <header style={css('display:flex; align-items:center; gap:16px')}>
        <span style={css('font-size:22px; font-weight:700; letter-spacing:-0.03em; background:var(--grad-brand); -webkit-background-clip:text; background-clip:text; color:transparent')}>iLead</span>
        <span style={css('font-size:13px; color:var(--ik-text-2)')}>Week 2 of 8 · Week end</span>
        <span style={css('flex:1')}></span>
        <button type="button" onClick={toEnd} style={css('border:0; background:transparent; color:var(--ik-text-2); font-size:12px; font-weight:600; cursor:pointer')}>
          Prototype shortcut: jump to the end of the simulation
        </button>
      </header>

      {step === 'banner' && (
        <div style={css('flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:24px; text-align:center')}>
          <div aria-hidden="true" style={css('position:absolute; left:50%; top:45%; width:560px; height:560px; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle, oklch(0.75 0.14 200 / 0.35), transparent 65%)')}></div>
          <span style={css(`position:relative; ${EYEBROW}`)}>End of week 2</span>
          <h1 style={css('position:relative; margin:0; font-size:64px; line-height:1; font-weight:700; letter-spacing:-0.03em')}>Kent is back in the game.</h1>
          <div aria-label="2 of 3 stars this week" style={css('position:relative; display:flex; gap:14px')}>
            {STARS.map(st => (
              <svg key={st.gid} width="64" height="64" viewBox="0 0 24 24" style={css(`animation:ilIn 500ms cubic-bezier(.2,.9,.3,1.3) both; animation-delay:${st.delay}`)}>
                <defs>
                  <linearGradient id={uid + st.gid} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#249DFF"></stop>
                    <stop offset=".5" stopColor="#43D6E8"></stop>
                    <stop offset="1" stopColor="#00F2AD"></stop>
                  </linearGradient>
                </defs>
                <polygon points={STAR_POINTS} fill={st.filled ? `url(#${uid}${st.gid})` : 'transparent'} stroke={st.stroke} strokeWidth="1.2" strokeLinejoin="round"></polygon>
              </svg>
            ))}
          </div>
          <p style={css('position:relative; margin:0; font-size:17px; color:var(--ik-text-2); max-width:560px; text-wrap:pretty')}>
            You made time for the people who needed it. Revenue is still behind pace, so next week is about demos.
          </p>
          <div style={css('position:relative')}>
            <NoWrapButton variant="primary" size="lg" onClick={next}>See your week</NoWrapButton>
          </div>
        </div>
      )}

      {step === 'report' && (
        <div style={css('flex:1; display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,1fr); gap:20px; animation:ilIn 300ms ease')}>
          <div style={css('display:flex; flex-direction:column; gap:20px')}>
            <div style={css(`${CARD} gap:12px`)}>
              <div style={css('display:flex; justify-content:space-between')}>
                <h2 style={css('margin:0; font-size:20px; font-weight:700')}>Funnel this week</h2>
                <span style={css('font-size:12px; color:var(--ik-text-2)')}>Bar is this week, tick is ideal</span>
              </div>
              {funnel.map((fn, i) => (
                <div key={i} style={css('display:grid; grid-template-columns:130px 1fr 70px; gap:12px; align-items:center; font-size:13px')}>
                  <span>{fn.n}</span>
                  <div style={css('position:relative; height:12px; border-radius:6px; background:var(--ik-track)')}>
                    <div style={css(`height:100%; width:${fn.w}; border-radius:6px; background:${fn.bg}`)}></div>
                    <div style={css(`position:absolute; top:-4px; bottom:-4px; left:${fn.ideal}; width:2px; background:var(--ik-text)`)}></div>
                  </div>
                  <b style={css('text-align:right')}>{fn.v}</b>
                </div>
              ))}
              <span style={css('font-size:13px; color:var(--ik-warn); font-weight:600')}>Closing converted the least against ideal. That is your bottleneck going into week 3.</span>
            </div>
            <div style={css(`${CARD} gap:10px`)}>
              <h2 style={css('margin:0; font-size:20px; font-weight:700')}>Team over the week</h2>
              <div style={css('display:grid; grid-template-columns:1fr 70px 70px 70px; gap:8px; font-size:12px; font-weight:700; color:var(--ik-text-2)')}>
                <span></span>
                <span style={css('text-align:right')}>Start</span>
                <span style={css('text-align:right')}>Change</span>
                <span style={css('text-align:right')}>End</span>
              </div>
              {KPIS.map(k => (
                <div key={k.n} style={css('display:grid; grid-template-columns:1fr 70px 70px 70px; gap:8px; padding:8px 0; border-top:1px solid var(--ik-line); font-size:14px')}>
                  <span>{k.n}</span>
                  <span style={css('text-align:right')}>{k.a}</span>
                  <b style={css(`text-align:right; color:${k.c}`)}>{k.d}</b>
                  <b style={css('text-align:right')}>{k.b}</b>
                </div>
              ))}
            </div>
          </div>
          <div style={css('display:flex; flex-direction:column; gap:20px')}>
            <div style={css(`${CARD} gap:12px`)}>
              <h2 style={css('margin:0; font-size:20px; font-weight:700')}>Stars earned</h2>
              {STAR_ROWS.map(sr => (
                <div key={sr.t} style={css('display:flex; gap:12px; align-items:center')}>
                  <svg width="26" height="26" viewBox="0 0 24 24">
                    <polygon points={STAR_POINTS} fill={sr.fill} stroke={sr.stroke} strokeWidth="1.5"></polygon>
                  </svg>
                  <span style={css('display:flex; flex-direction:column')}>
                    <b style={css('font-size:14px')}>{sr.t}</b>
                    <span style={css('font-size:12px; color:var(--ik-text-2)')}>{sr.d}</span>
                  </span>
                </div>
              ))}
            </div>
            <div style={css('display:grid; grid-template-columns:1fr 1fr; gap:14px')}>
              <div style={css('padding:18px; border-radius:24px; background:var(--ik-card); border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:6px')}>
                <span style={css('font-size:12px; color:var(--ik-text-2)')}>Streak</span>
                <b style={css('font-size:26px; display:flex; align-items:center; gap:6px')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="oklch(0.8 0.15 60)">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
                  </svg>
                  3 days
                </b>
                <span style={css('font-size:12px; color:var(--ik-text-2)')}>Replied to every message on time. 2 more days for a bonus.</span>
              </div>
              <div style={css('padding:18px; border-radius:24px; background:var(--ik-card); border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:6px')}>
                <span style={css('font-size:12px; color:var(--ik-text-2)')}>Sponsor confidence</span>
                <b style={css('font-size:22px')}>Steady to Confident</b>
                <span style={css('font-size:12px; color:var(--ik-pos); font-weight:700')}>▲ One step up</span>
              </div>
              <div style={css('grid-column:1 / -1; padding:18px; border-radius:24px; background:var(--ik-card); border:1px solid var(--ik-line); display:flex; flex-direction:column; gap:8px')}>
                <span style={css('font-size:12px; color:var(--ik-text-2)')}>Team Pulse</span>
                <div style={css('display:flex; height:12px; border-radius:6px; overflow:hidden; gap:2px')}>
                  <div style={css('flex:6; background:#00F2AD')}></div>
                  <div style={css('flex:3; background:#DEE9FF')}></div>
                  <div style={css('flex:1; background:oklch(0.84 0.14 78)')}></div>
                </div>
                <span style={css('font-size:13px')}>
                  <b>6</b> upbeat · <b>3</b> steady · <b>1</b> struggling, up from 3 struggling last week
                </span>
              </div>
            </div>
            <div style={css('display:flex; justify-content:flex-end')}>
              <NoWrapButton variant="primary" size="lg" onClick={next}>Continue</NoWrapButton>
            </div>
          </div>
        </div>
      )}

      {step === 'badge' && (
        <div style={css('flex:1; display:flex; align-items:center; justify-content:center')}>
          <div role="dialog" aria-label="Badge earned" style={css('width:460px; padding:32px; border-radius:30px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); box-shadow:0 0 80px oklch(0.75 0.14 200 / 0.35); display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; animation:ilIn 400ms cubic-bezier(.2,.9,.3,1.2)')}>
            <div style={css('width:140px; height:140px; border-radius:50%; background:var(--grad-spectrum); display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 8px oklch(1 0 0 / 0.08)')}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#0A081B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7-6 6-6 10"></path>
                <path d="M9 8a3 3 0 0 1 6 0"></path>
                <circle cx="12" cy="21" r="1"></circle>
              </svg>
            </div>
            <span style={css(EYEBROW)}>Badge earned · 1 of 1</span>
            <h2 style={css('margin:0; font-size:30px; font-weight:700')}>Listener</h2>
            <p style={css('margin:0; color:var(--ik-text-2)')}>You asked three open questions in your 1:1 with Kent before offering a fix.</p>
            <div style={css('display:flex; gap:10px')}>
              <NoWrapButton variant="ghost" size="md" onClick={next}>Skip</NoWrapButton>
              <NoWrapButton variant="primary" size="md" onClick={next}>Nice</NoWrapButton>
            </div>
          </div>
        </div>
      )}

      {step === 'unlock' && (
        <div style={css('flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; animation:ilIn 300ms ease')}>
          <span style={css(EYEBROW)}>Priya's confidence went up</span>
          <h1 style={css('margin:0; font-size:40px; font-weight:700; letter-spacing:-0.02em')}>Choose one reward for week 3</h1>
          <div role="radiogroup" aria-label="Rewards" style={css('display:grid; grid-template-columns:repeat(3,280px); gap:16px')}>
            {REWARDS.map((r, i) => {
              const on = reward === i;
              const border = on ? 'var(--ik-acc-2)' : 'var(--ik-line)';
              const bg = on ? 'var(--ik-acc-soft)' : 'var(--ik-card)';
              const lift = on ? 'translateY(-6px)' : 'none';
              return (
                <button
                  key={r.n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setReward(i)}
                  style={css(`padding:20px; border-radius:24px; border:2px solid ${border}; background:${bg}; color:var(--ik-text); text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:10px; transform:${lift}; transition:transform 200ms ease`)}
                >
                  <span style={css(`height:90px; border-radius:16px; background:${r.art}`)}></span>
                  <b style={css('font-size:17px')}>{r.n}</b>
                  <span style={css('font-size:13px; color:var(--ik-text-2)')}>{r.d}</span>
                </button>
              );
            })}
          </div>
          <NoWrapButton variant="primary" size="lg" disabled={reward === null} onClick={next}>Take this reward</NoWrapButton>
        </div>
      )}

      {step === 'news' && (
        <div style={css('flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; animation:ilIn 300ms ease')}>
          <span style={css(EYEBROW)}>Week 3 news · {newsPos}</span>
          <div style={css('width:720px; max-width:100%; border-radius:28px; overflow:hidden; background:var(--ik-mat); border:1px solid var(--ik-line-strong)')}>
            <div style={css(`height:220px; background:${news.art}; position:relative`)}>
              <span style={css('position:absolute; top:14px; left:18px; font-size:12px; font-weight:700; color:#0A081B')}>Illustration from GenieKreator config</span>
            </div>
            <div style={css('padding:22px 24px; display:flex; flex-direction:column; gap:10px')}>
              <h2 style={css('margin:0; font-size:26px; font-weight:700; letter-spacing:-0.02em')}>{news.t}</h2>
              <p style={css('margin:0; color:var(--ik-text-2)')}>{news.d}</p>
              {impact && <div style={css('padding:12px; border-radius:14px; background:var(--ik-raised); font-size:13px')}>{news.impact}</div>}
              <div style={css('display:flex; gap:10px; align-items:center')}>
                <button type="button" onClick={() => setImpact(x => !x)} style={css('border:0; background:transparent; color:var(--ik-acc-2); font-weight:700; font-size:13px; cursor:pointer; padding:0')}>
                  See impact
                </button>
                <span style={css('flex:1')}></span>
                <NoWrapButton variant="secondary" size="md" disabled={newsIdx === 0} onClick={prevNews}>Previous</NoWrapButton>
                <NoWrapButton variant="primary" size="md" onClick={nextNews}>{newsCta}</NoWrapButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
